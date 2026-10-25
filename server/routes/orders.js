import { Router } from 'express';
import { getDb, saveDb, parsePriceNumber } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  ORDER_STATUSES,
  canTransitionOrderStatus,
  getAllowedNextStatuses,
  getOrderStatusLabel,
  isOrderStatus,
  normalizeOrderStatus
} from '../../shared/orderStatus.js';
import {
  CANCELLABLE_ORDER_STATUSES,
  canActorCancelOrderStatus,
  getCancelActorLabel,
  resolveCancellationInput
} from '../../shared/orderCancellation.js';

const router = Router();

const RESTAURANT_ROLES = new Set(['restaurant', 'restaurant_owner', 'restaurant_manager']);

function toNumericIdList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => Number(item))
      .filter(item => Number.isFinite(item));
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return [];
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? [parsed] : [];
}

function getManagedRestaurantIds(user, db) {
  if (!user) return [];
  const ids = new Set([
    ...toNumericIdList(user.restaurantId),
    ...toNumericIdList(user.restaurantIds),
    ...toNumericIdList(user.managedRestaurantIds)
  ]);

  (db.restaurants || []).forEach(restaurant => {
    const restaurantId = Number(restaurant.id);
    const ownerId = Number(restaurant.ownerId);
    const managerId = Number(restaurant.managerId);
    const managerIds = toNumericIdList(restaurant.managerIds);
    if (ownerId === user.id || managerId === user.id || managerIds.includes(user.id)) {
      ids.add(restaurantId);
    }
  });

  return [...ids];
}

function canManageRestaurant(user, restaurantId, db) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!RESTAURANT_ROLES.has(user.role)) return false;
  return getManagedRestaurantIds(user, db).includes(Number(restaurantId));
}

function resolveCancelActor(user) {
  if (!user) return '';
  if (user.role === 'admin') return 'admin';
  if (RESTAURANT_ROLES.has(user.role)) return 'restaurant';
  return 'customer';
}

function findOrderById(db, orderId) {
  return (db.orders || []).find(o => o.id === orderId || o.code === orderId);
}

// Mã giảm giá hợp lệ của hệ thống
const VALID_COUPONS = {
  FOODHUB10: { type: 'percent', value: 10, max: 50000, description: 'Giảm 10% tối đa 50k' },
  FREESHIP: { type: 'freeship', description: 'Miễn phí vận chuyển 15k' },
  BANMOI: { type: 'fixed', value: 20000, minOrder: 50000, description: 'Giảm 20k cho đơn từ 50k' }
};

function generateOrderCode() {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FH${dateStr}-${randomStr}`;
}

// Bóc tách giá tiền từ chuỗi kiểu Việt Nam (ví dụ "75.000đ" -> 75000)
function parsePriceNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return 0;
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

// Tìm món ăn trong thực đơn quán. Ưu tiên khớp theo id, sau đó theo tên,
// cuối cùng theo chỉ mục. Điều này giúp hệ thống hoạt động cả khi dữ liệu
// thực đơn không có trường id (tương thích ngược).
function findMenuItem(menu, item) {
  if (!Array.isArray(menu)) return null;

  const itemId = item.dishId !== undefined ? item.dishId : item.id;
  if (itemId !== undefined && itemId !== null && itemId !== '') {
    const byId = menu.find(m => m.id !== undefined && String(m.id) === String(itemId));
    if (byId) return byId;
  }

  if (item.name) {
    const byName = menu.find(m => m.name === item.name);
    if (byName) return byName;
  }

  const index = Number(itemId);
  if (Number.isInteger(index) && index >= 0 && index < menu.length) {
    return menu[index];
  }

  return null;
}

// 1. Khách hàng tạo đơn hàng mới
// POST /api/orders
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      restaurantId,
      items,
      recipientName,
      recipientPhone,
      contactEmail,
      emailVerificationToken,
      deliveryAddress,
      note,
      paymentMethod = 'COD',
      couponCode
    } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin quán ăn đặt hàng.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng của bạn đang trống.' });
    }

    if (!recipientName || recipientName.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp họ tên người nhận (tối thiểu 2 ký tự).' });
    }

    const cleanPhone = (recipientPhone || '').trim();
    if (!cleanPhone || !/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại nhận hàng không hợp lệ (cần 10 chữ số).' });
    }

    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Địa chỉ giao hàng cần tối thiểu 5 ký tự.' });
    }

    // Bắt buộc email hợp lệ và phải được xác nhận qua OTP trước khi đặt hàng
    const cleanEmail = (contactEmail || '').trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email hợp lệ để nhận thông tin đơn hàng.' });
    }

    if (!emailVerificationToken) {
      return res.status(400).json({ success: false, message: 'Email chưa được xác nhận. Vui lòng xác nhận email bằng mã OTP trước khi đặt hàng.' });
    }

    if (!isEmailVerified(cleanEmail, emailVerificationToken)) {
      return res.status(400).json({ success: false, message: 'Mã xác nhận email không hợp lệ hoặc đã hết hạn. Vui lòng xác nhận lại email.' });
    }

    const finalPaymentMethod = VALID_PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : 'COD';

    const db = getDb();
    const restId = Number(restaurantId);
    const restaurant = db.restaurants.find(r => r.id === restId);
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Quán ăn không tồn tại hoặc đã ngừng hoạt động.' });
    }

    // Xác minh từng món ăn từ menu gốc của quán (chống gian lận giá và kiểm tra trạng thái còn hàng)
    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu món ăn trong giỏ hàng không hợp lệ.'
        });
      }

      const itemRestaurantId = item.restaurantId === undefined || item.restaurantId === null ||
        String(item.restaurantId).trim() === ''
        ? restId
        : Number(item.restaurantId);
      if (!Number.isFinite(itemRestaurantId) || itemRestaurantId !== restId) {
        return res.status(400).json({
          success: false,
          message: `Món "${item.name || 'đã chọn'}" thuộc quán khác, không thể đặt tại ${restaurant.name}.`
        });
      }

      const rawDishId = item.dishId ?? item.id;
      const dishId = Number(rawDishId);
      const menu = restaurant.menu || [];
      let dishInMenu = Number.isFinite(dishId) && dishId > 0
        ? menu.find(m => Number(m.id) === dishId)
        : null;

      // Giỏ hàng cũ có thể chưa có dishId (dữ liệu menu trước đây thiếu id).
      // Chỉ dự phòng theo tên chính xác khi id không thuộc một quán khác.
      if (!dishInMenu && item.name) {
        const idBelongsToAnotherRestaurant = Number.isFinite(dishId) && dishId > 0 &&
          db.restaurants.some(r =>
            Number(r.id) !== restId &&
            Array.isArray(r.menu) &&
            r.menu.some(m => Number(m.id) === dishId)
          );

        if (!idBelongsToAnotherRestaurant) {
          dishInMenu = menu.find(m => m.name === item.name);
        }
      }

      if (!dishInMenu) {
        return res.status(400).json({
          success: false,
          message: `Món ăn "${item.name || dishId}" không thuộc thực đơn của quán ${restaurant.name}.`
        });
      }

      if (dishInMenu.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `Món "${dishInMenu.name}" hiện tại đã hết, vui lòng chọn món khác.`
        });
      }

      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Số lượng món "${dishInMenu.name}" không hợp lệ.`
        });
      }
      if (quantity > 99) {
        return res.status(400).json({
          success: false,
          message: `Số lượng món "${dishInMenu.name}" vượt quá giới hạn đặt tối đa (99 suất).`
        });
      }

      // Lấy giá chuẩn từ cơ sở dữ liệu backend
      const unitPrice = Number(dishInMenu.priceNum) || parsePriceNumber(dishInMenu.price);
      if (unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Món "${dishInMenu.name}" có giá không hợp lệ để đặt hàng trực tuyến.`
        });
      }

      const hasClientPrice = item.priceNum !== undefined && item.priceNum !== null &&
        String(item.priceNum).trim() !== '';
      const clientPrice = Number(item.priceNum);
      if (hasClientPrice && (!Number.isFinite(clientPrice) || clientPrice !== unitPrice)) {
        return res.status(400).json({
          success: false,
          message: `Giá món "${dishInMenu.name}" đã thay đổi. Vui lòng tải lại giỏ hàng trước khi đặt.`
        });
      }

      const itemTotal = unitPrice * quantity;
      subtotal += itemTotal;

      const menuIndex = (restaurant.menu || []).indexOf(dishInMenu);
      verifiedItems.push({
        dishId: dishInMenu.id,
        restaurantId: restaurant.id,
        name: dishInMenu.name,
        price: dishInMenu.price,
        priceNum: unitPrice,
        image: dishInMenu.image || '',
        quantity,
        total: itemTotal
      });
    }

    // Tính phí giao hàng: 15.000đ (miễn phí với đơn từ 200.000đ)
    let shippingFee = subtotal >= 200000 ? 0 : 15000;

    // Tính giảm giá theo mã coupon
    let discount = 0;
    let appliedCoupon = '';

    if (couponCode) {
      const codeUpper = String(couponCode).trim().toUpperCase();
      const coupon = VALID_COUPONS[codeUpper];
      if (coupon) {
        if (coupon.type === 'percent') {
          discount = Math.min(coupon.max || 50000, Math.round((subtotal * coupon.value) / 100));
          appliedCoupon = codeUpper;
        } else if (coupon.type === 'freeship') {
          discount = shippingFee;
          appliedCoupon = codeUpper;
        } else if (coupon.type === 'fixed') {
          if (subtotal >= (coupon.minOrder || 0)) {
            discount = coupon.value;
            appliedCoupon = codeUpper;
          }
        }
      }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    const orderCode = generateOrderCode();

    const newOrder = {
      id: orderCode,
      code: orderCode,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: restaurant.address,
      restaurantImage: restaurant.image,
      recipientName: recipientName.trim(),
      recipientPhone: cleanPhone,
      contactEmail: cleanEmail,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      deliveryAddress: deliveryAddress.trim(),
      note: note ? note.trim() : '',
      items: verifiedItems,
      totalItems: verifiedItems.reduce((acc, cur) => acc + cur.quantity, 0),
      subtotal,
      shippingFee,
      discount,
      couponCode: appliedCoupon,
      total,
      paymentMethod: finalPaymentMethod,
      paymentStatus: 'unpaid',
      status: 'pending', // pending -> confirmed -> preparing -> shipping -> completed / cancelled
      timeline: [
        {
          status: 'pending',
          time: new Date().toISOString(),
          message: 'Đơn hàng được khởi tạo thành công (Chờ xác nhận)'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!Array.isArray(db.orders)) {
      db.orders = [];
    }
    db.orders.unshift(newOrder);

    // Token xác nhận email chỉ được dùng một lần cho một đơn hàng
    consumeEmailVerification(cleanEmail);

    // Xóa giỏ hàng của user sau khi đặt hàng thành công
    const userCart = db.carts.find(c => c.userId === req.user.id);
    if (userCart) {
      userCart.items = [];
      userCart.restaurantId = null;
      userCart.restaurantName = '';
      userCart.restaurantAddress = '';
      userCart.updatedAt = new Date().toISOString();
    }

    saveDb();

    res.status(201).json({
      success: true,
      message: 'Đặt hàng thành công! Đơn hàng của bạn đang được quán xử lý.',
      data: newOrder
    });
  } catch (error) {
    console.error('Lỗi tạo đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo đơn hàng.' });
  }
});

// 2. Lấy danh sách đơn hàng của khách hàng đang đăng nhập
// GET /api/orders/my
router.get('/my', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const myOrders = (db.orders || []).filter(o => o.userId === req.user.id);

    myOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: myOrders,
      total: myOrders.length
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách đơn cá nhân:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải đơn hàng cá nhân.' });
  }
});

// 3. Lấy danh sách đơn hàng thuộc quán mà tài khoản chủ quán được quản lý
// GET /api/orders/restaurant/my
router.get('/restaurant/my', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    if (resolveCancelActor(req.user) !== 'restaurant') {
      return res.status(403).json({
        success: false,
        message: 'Chức năng này chỉ dành cho tài khoản chủ quán.'
      });
    }

    const restaurantIds = getManagedRestaurantIds(req.user, db);
    if (restaurantIds.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn chưa được gán quyền quản lý quán ăn nào.'
      });
    }

    const orders = (db.orders || [])
      .filter(order => restaurantIds.includes(Number(order.restaurantId)))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const restaurants = (db.restaurants || [])
      .filter(restaurant => restaurantIds.includes(Number(restaurant.id)))
      .map(restaurant => ({
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        image: restaurant.image
      }));

    res.json({
      success: true,
      data: orders,
      total: orders.length,
      restaurants
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách đơn hàng của quán:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải đơn hàng của quán.' });
  }
});

// 4. Khách hàng kiểm tra chi tiết đơn hàng
// GET /api/orders/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const order = (db.orders || []).find(o => o.id === orderId || o.code === orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    // Bảo mật: Khách chỉ xem đơn của mình, quán chỉ xem đơn thuộc quán mình quản lý, Admin xem tất cả
    const canViewOrder =
      req.user.role === 'admin' ||
      order.userId === req.user.id ||
      (RESTAURANT_ROLES.has(req.user.role) && canManageRestaurant(req.user, order.restaurantId, db));

    if (!canViewOrder) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Lỗi xem chi tiết đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải chi tiết đơn hàng.' });
  }
});

// 5. Hủy đơn hàng (khách hàng / quán / quản trị viên)
// PATCH hoặc POST /api/orders/:id/cancel
function cancelOrderHandler(req, res) {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const order = findOrderById(db, orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const actor = resolveCancelActor(req.user);
    if (!actor) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn hàng này.' });
    }

    if (actor === 'customer' && order.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ được hủy đơn hàng thuộc tài khoản của mình.'
      });
    }

    if (actor === 'restaurant' && !canManageRestaurant(req.user, order.restaurantId, db)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy đơn hàng của quán khác.'
      });
    }

    const currentStatus = normalizeOrderStatus(order.status);
    if (currentStatus === 'cancelled') {
      return res.status(409).json({
        success: false,
        code: 'ORDER_ALREADY_CANCELLED',
        message: 'Đơn hàng đã bị hủy trước đó.',
        currentStatus: order.status
      });
    }

    if (currentStatus === 'completed') {
      return res.status(409).json({
        success: false,
        code: 'ORDER_COMPLETED',
        message: 'Đơn hàng đã hoàn thành, không thể hủy.',
        currentStatus: order.status
      });
    }

    if (!canActorCancelOrderStatus(currentStatus)) {
      return res.status(409).json({
        success: false,
        code: 'ORDER_NOT_CANCELLABLE',
        message: `Không thể hủy đơn hàng đang ở trạng thái "${getOrderStatusLabel(currentStatus)}".`,
        currentStatus: order.status,
        allowedStatuses: [...CANCELLABLE_ORDER_STATUSES]
      });
    }

    const hasExpectedStatus = req.body?.expectedStatus !== undefined &&
      req.body?.expectedStatus !== null &&
      String(req.body.expectedStatus).trim() !== '';
    if (hasExpectedStatus && normalizeOrderStatus(req.body.expectedStatus) !== currentStatus) {
      return res.status(409).json({
        success: false,
        code: 'ORDER_STATUS_CHANGED',
        message: `Trạng thái đơn đã thay đổi thành "${getOrderStatusLabel(order.status)}". Vui lòng làm mới và thử lại.`,
        currentStatus: order.status,
        expectedStatus: req.body.expectedStatus
      });
    }

    const rawReason = req.body?.reason ?? req.body?.cancelReason;
    const rawNote = req.body?.note ?? req.body?.cancelNote;
    const cancellation = resolveCancellationInput(actor, rawReason, rawNote);

    if (!cancellation.ok) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_CANCEL_REASON',
        message: cancellation.message
      });
    }

    const now = new Date().toISOString();
    const previousStatus = currentStatus;
    const beforeSnapshot = {
      status: order.status,
      cancelReason: order.cancelReason,
      cancelReasonCode: order.cancelReasonCode,
      cancelNote: order.cancelNote,
      cancelledBy: order.cancelledBy,
      cancelledById: order.cancelledById,
      cancelledByName: order.cancelledByName,
      cancelledAt: order.cancelledAt,
      updatedAt: order.updatedAt,
      timelineLength: Array.isArray(order.timeline) ? order.timeline.length : 0
    };

    const actorLabel = getCancelActorLabel(actor);
    order.status = 'cancelled';
    order.cancelledBy = actor;
    order.cancelledById = req.user.id;
    order.cancelledByName = req.user.name || '';
    order.cancelReason = cancellation.value.reason;
    order.cancelReasonCode = cancellation.value.reasonCode;
    order.cancelNote = cancellation.value.note;
    order.cancelledAt = now;
    order.updatedAt = now;

    if (!Array.isArray(order.timeline)) {
      order.timeline = [];
    }

    const noteSuffix = cancellation.value.note ? ` - Ghi chú: ${cancellation.value.note}` : '';
    order.timeline.push({
      status: 'cancelled',
      fromStatus: previousStatus,
      toStatus: 'cancelled',
      time: now,
      cancelledAt: now,
      message: `Đơn hàng đã bị hủy bởi ${actorLabel}. Lý do: ${cancellation.value.reason}${noteSuffix}`,
      cancelledBy: actor,
      cancelledById: req.user.id,
      cancelledByName: req.user.name || '',
      cancelReason: cancellation.value.reason,
      cancelReasonCode: cancellation.value.reasonCode,
      cancelNote: cancellation.value.note
    });

    if (!saveDb()) {
      order.status = beforeSnapshot.status;
      order.cancelReason = beforeSnapshot.cancelReason;
      order.cancelReasonCode = beforeSnapshot.cancelReasonCode;
      order.cancelNote = beforeSnapshot.cancelNote;
      order.cancelledBy = beforeSnapshot.cancelledBy;
      order.cancelledById = beforeSnapshot.cancelledById;
      order.cancelledByName = beforeSnapshot.cancelledByName;
      order.cancelledAt = beforeSnapshot.cancelledAt;
      order.updatedAt = beforeSnapshot.updatedAt;
      if (Array.isArray(order.timeline)) {
        order.timeline = order.timeline.slice(0, beforeSnapshot.timelineLength);
      }
      return res.status(500).json({
        success: false,
        message: 'Không thể lưu thông tin hủy đơn. Vui lòng thử lại.'
      });
    }

    res.json({
      success: true,
      message: 'Hủy đơn hàng thành công.',
      data: order
    });
  } catch (error) {
    console.error('Lỗi hủy đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy đơn hàng.' });
  }
}

router.patch('/:id/cancel', authenticateToken, cancelOrderHandler);
router.post('/:id/cancel', authenticateToken, cancelOrderHandler);

// 6. Quản trị viên: Lấy toàn bộ đơn hàng hệ thống
// GET /api/orders/admin/all
router.get('/admin/all', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { status, search, restaurantId } = req.query;

    let orders = [...(db.orders || [])];

    if (status && status !== 'all') {
      orders = orders.filter(o => o.status === status);
    }

    if (restaurantId) {
      orders = orders.filter(o => o.restaurantId === Number(restaurantId));
    }

    if (search) {
      const q = String(search).toLowerCase().trim();
      orders = orders.filter(o =>
        (o.code && o.code.toLowerCase().includes(q)) ||
        (o.recipientName && o.recipientName.toLowerCase().includes(q)) ||
        (o.recipientPhone && o.recipientPhone.includes(q)) ||
        (o.restaurantName && o.restaurantName.toLowerCase().includes(q))
      );
    }

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: orders,
      total: orders.length
    });
  } catch (error) {
    console.error('Lỗi tải danh sách đơn admin:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải danh sách đơn hàng.' });
  }
});

// 7. Quản trị viên: Lấy thống kê đơn hàng
// GET /api/orders/admin/stats
router.get('/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orders = db.orders || [];

    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      shipping: orders.filter(o => o.status === 'shipping').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalRevenue: orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Lỗi thống kê đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thống kê đơn hàng.' });
  }
});

// 8. Quản trị viên: Cập nhật trạng thái đơn hàng
// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const { status, note, expectedStatus } = req.body;
    const nextStatus = normalizeOrderStatus(status);

    if (!isOrderStatus(nextStatus)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_NEXT_STATUS',
        message: `Trạng thái không hợp lệ. Cho phép: ${ORDER_STATUSES.join(', ')}`
      });
    }

    const order = (db.orders || []).find(o => o.id === orderId || o.code === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    if (nextStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        code: 'CANCEL_REQUIRES_REASON',
        message: 'Hủy đơn phải thực hiện qua chức năng hủy đơn và bắt buộc nhập lý do hợp lệ.'
      });
    }

    const hasExpectedStatus = expectedStatus !== undefined &&
      expectedStatus !== null &&
      String(expectedStatus).trim() !== '';
    const expected = hasExpectedStatus ? normalizeOrderStatus(expectedStatus) : '';

    if (hasExpectedStatus && expected !== normalizeOrderStatus(order.status)) {
      return res.status(409).json({
        success: false,
        code: 'ORDER_STATUS_CHANGED',
        message: `Trạng thái đơn đã thay đổi thành "${getOrderStatusLabel(order.status)}". Vui lòng làm mới và thử lại.`,
        currentStatus: order.status,
        expectedStatus: expected,
        allowedStatuses: getAllowedNextStatuses(order.status)
      });
    }

    const transition = canTransitionOrderStatus(order.status, nextStatus);
    if (!transition.allowed) {
      return res.status(transition.statusCode).json({
        success: false,
        code: transition.code,
        message: transition.message,
        currentStatus: order.status,
        requestedStatus: nextStatus,
        allowedStatuses: transition.allowedStatuses
      });
    }

    const statusMessages = {
      pending: 'Chờ xác nhận',
      confirmed: 'Quán ăn đã xác nhận đơn hàng',
      preparing: 'Quán ăn đang chuẩn bị món',
      shipping: 'Tài xế đang giao hàng',
      completed: 'Giao hàng thành công (Hoàn tất)',
      cancelled: 'Đơn hàng đã bị hủy'
    };

    order.status = nextStatus;
    order.updatedAt = new Date().toISOString();

    if (nextStatus === 'completed') {
      order.paymentStatus = 'paid';
    }

    if (!Array.isArray(order.timeline)) {
      order.timeline = [];
    }

    order.timeline.push({
      status: nextStatus,
      time: new Date().toISOString(),
      message: note ? `Trạng thái: ${statusMessages[nextStatus]} (${note})` : statusMessages[nextStatus]
    });

    saveDb();

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn sang: ${statusMessages[nextStatus]}`,
      data: order
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái đơn:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật đơn hàng.' });
  }
});

export default router;

