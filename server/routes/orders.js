import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateCouponLogic, calculateCouponDiscount } from './coupons.js';

const router = Router();

// Chuẩn số điện thoại di động Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)
export const VN_PHONE_REGEX = /^(?:\+?84|0)(3[2-9]|5[5-9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

export function normalizeVnPhone(phone) {
  let p = String(phone || '').trim().replace(/[\s.-]/g, '');
  if (p.startsWith('+84')) {
    p = '0' + p.slice(3);
  } else if (p.startsWith('84') && p.length === 11) {
    p = '0' + p.slice(2);
  }
  return p;
}

function generateOrderCode() {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FH${dateStr}-${randomStr}`;
}

export const VALID_ORDER_STATUSES = [
  'pending',     // 1. Chờ xác nhận
  'confirmed',   // 2. Đã xác nhận
  'preparing',   // 3. Đang chuẩn bị món
  'ready',       // 4. Đã sẵn sàng giao (chờ shipper lấy)
  'shipping',    // 5. Đang giao hàng
  'completed',   // 6. Giao thành công
  'cancelled'    // 7. Đã hủy
];

export const ORDER_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Đã sẵn sàng giao',
  shipping: 'Đang giao hàng',
  completed: 'Giao thành công',
  cancelled: 'Đã hủy'
};

// 1. Khách hàng tạo đơn hàng mới
// POST /api/orders
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      restaurantId,
      items,
      recipientName,
      recipientPhone,
      deliveryAddress,
      addressDetails,
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

    const rawPhone = (recipientPhone || '').trim();
    if (!VN_PHONE_REGEX.test(rawPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại nhận hàng không đúng định dạng di động Việt Nam (10 số, đầu 03, 05, 07, 08, 09).'
      });
    }
    const cleanPhone = normalizeVnPhone(rawPhone);

    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Địa chỉ giao hàng cần tối thiểu 5 ký tự.' });
    }

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
      const rawDishId = item.dishId !== undefined ? item.dishId : (item.id !== undefined ? item.id : (item.foodId || item.menuItemId));
      const numDishId = (rawDishId !== null && rawDishId !== undefined && !isNaN(Number(rawDishId))) ? Number(rawDishId) : null;
      const rawName = String(item.name || '').trim().toLowerCase();

      // Tìm món ăn trong thực đơn của quán: ưu tiên theo ID chuẩn, fallback theo Tên món
      const dishInMenu = (restaurant.menu || []).find((m, idx) => {
        // 1. Khớp theo ID nếu có ID số hợp lệ
        if (numDishId !== null) {
          if (m.id !== undefined && Number(m.id) === numDishId) return true;
          if (Number(idx + 1) === numDishId) return true;
        }
        // 2. Khớp theo tên món (chính xác không phân biệt hoa thường)
        if (rawName && m.name && m.name.trim().toLowerCase() === rawName) {
          return true;
        }
        return false;
      });

      if (!dishInMenu) {
        const displayItemName = item.name || (numDishId !== null ? `mã #${numDishId}` : 'chưa xác định');
        return res.status(400).json({
          success: false,
          message: `Món ăn "${displayItemName}" không thuộc thực đơn của quán ${restaurant.name}.`
        });
      }

      if (dishInMenu.isAvailable === false) {
        return res.status(400).json({
          success: false,
          message: `Món "${dishInMenu.name}" hiện tại đã hết, vui lòng chọn món khác.`
        });
      }

      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (quantity > 99) {
        return res.status(400).json({
          success: false,
          message: `Số lượng món "${dishInMenu.name}" vượt quá giới hạn đặt tối đa (99 suất).`
        });
      }

      // Lấy giá chuẩn từ cơ sở dữ liệu backend
      const unitPrice = Number(dishInMenu.priceNum) || (parseInt(String(dishInMenu.price || '').replace(/[^\d]/g, ''), 10) || 0);
      if (unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Món "${dishInMenu.name}" có giá không hợp lệ để đặt hàng trực tuyến.`
        });
      }

      const itemTotal = unitPrice * quantity;
      subtotal += itemTotal;

      const finalDishId = (dishInMenu.id !== undefined && !isNaN(Number(dishInMenu.id)) && Number(dishInMenu.id) > 0)
        ? Number(dishInMenu.id)
        : (restId * 100 + ((restaurant.menu || []).indexOf(dishInMenu) + 1));

      if (dishInMenu.id === undefined) {
        dishInMenu.id = finalDishId;
      }

      verifiedItems.push({
        dishId: finalDishId,
        id: finalDishId,
        name: dishInMenu.name,
        price: dishInMenu.price,
        priceNum: unitPrice,
        image: dishInMenu.image || '',
        quantity,
        note: item.note ? String(item.note).trim() : '',
        total: itemTotal
      });
    }

    // Phí giao hàng: 15.000đ (miễn phí với đơn từ 200.000đ)
    let shippingFee = subtotal >= 200000 ? 0 : 15000;

    // Tính giảm giá theo mã coupon (lấy từ db.coupons)
    let discount = 0;
    let appliedCoupon = '';
    let matchedCoupon = null;

    if (couponCode) {
      const codeUpper = String(couponCode).trim().toUpperCase();
      if (!Array.isArray(db.coupons)) db.coupons = [];
      matchedCoupon = db.coupons.find(c => c.code.toUpperCase() === codeUpper);

      if (matchedCoupon) {
        const check = validateCouponLogic(matchedCoupon, {
          subtotal,
          restaurantId: restId,
          userId: req.user.id
        });
        if (check.valid) {
          discount = calculateCouponDiscount(matchedCoupon, subtotal, shippingFee);
          appliedCoupon = codeUpper;
        } else {
          return res.status(400).json({
            success: false,
            message: `Mã giảm giá "${codeUpper}" không hợp lệ: ${check.message}`
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: `Mã giảm giá "${codeUpper}" không tồn tại trong hệ thống.`
        });
      }
    }

    const total = Math.max(0, subtotal + shippingFee - discount);
    const orderCode = generateOrderCode();

    // Ghi nhận lượt sử dụng coupon
    if (matchedCoupon && appliedCoupon) {
      matchedCoupon.usedCount = (matchedCoupon.usedCount || 0) + 1;
      if (!Array.isArray(matchedCoupon.usedBy)) matchedCoupon.usedBy = [];
      matchedCoupon.usedBy.push({
        userId: req.user.id,
        orderCode,
        usedAt: new Date().toISOString()
      });
    }

    const upperMethod = String(paymentMethod || '').toUpperCase();
    const normMethod = (upperMethod === 'BANK_TRANSFER' || upperMethod === 'BANKING' || upperMethod === 'TRANSFER') ? 'BANK_TRANSFER' : 'COD';

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
      deliveryAddress: deliveryAddress.trim(),
      addressDetails: addressDetails || null,
      note: note ? note.trim() : '',
      items: verifiedItems,
      totalItems: verifiedItems.reduce((acc, cur) => acc + cur.quantity, 0),
      subtotal,
      shippingFee,
      discount,
      couponCode: appliedCoupon,
      appliedCoupon: appliedCoupon,
      total,
      paymentMethod: normMethod,
      paymentStatus: 'unpaid', // unpaid | paid | refunded
      status: 'pending', // 7 standard statuses
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

// 3. Khách hàng kiểm tra chi tiết đơn hàng
// GET /api/orders/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const order = (db.orders || []).find(o => o.id === orderId || o.code === orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    // Bảo mật: Người dùng chỉ được xem đơn hàng của chính mình (trừ Admin)
    if (order.userId !== req.user.id && req.user.role !== 'admin') {
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

// 4. Khách hàng hoặc Admin hủy đơn hàng
// PATCH /api/orders/:id/cancel
router.patch('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const { reason = 'Khách hàng thay đổi ý định' } = req.body;

    const order = (db.orders || []).find(o => o.id === orderId || o.code === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn hàng này.' });
    }

    // Quy tắc hủy đơn: Chỉ cho phép hủy khi đang pending, confirmed hoặc preparing
    const cancellableStatuses = ['pending', 'confirmed', 'preparing'];
    if (!cancellableStatuses.includes(order.status)) {
      if (['ready', 'shipping'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'Món ăn đã sẵn sàng hoặc đang giao hàng, không thể hủy đơn. Vui lòng liên hệ hotline quán.'
        });
      }
      if (order.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Đơn hàng đã được giao thành công, không thể hủy.'
        });
      }
      if (order.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Đơn hàng này đã bị hủy trước đó.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng không thể hủy ở trạng thái hiện tại.'
      });
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp lý do hủy đơn (tối thiểu 3 ký tự).'
      });
    }

    // Hoàn lại lượt dùng mã giảm giá nếu có
    if (order.couponCode && Array.isArray(db.coupons)) {
      const coupon = db.coupons.find(c => c.code.toUpperCase() === order.couponCode.toUpperCase());
      if (coupon) {
        coupon.usedCount = Math.max(0, (coupon.usedCount || 1) - 1);
        if (Array.isArray(coupon.usedBy)) {
          coupon.usedBy = coupon.usedBy.filter(u => u.orderCode !== order.code);
        }
      }
    }

    const canceller = req.user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng';
    order.status = 'cancelled';
    order.cancelledBy = canceller;
    order.cancelledAt = new Date().toISOString();
    order.cancelReason = reason.trim();
    order.updatedAt = new Date().toISOString();

    if (!Array.isArray(order.timeline)) {
      order.timeline = [];
    }
    order.timeline.push({
      status: 'cancelled',
      time: new Date().toISOString(),
      message: `Đơn hàng đã bị hủy bởi ${canceller}. Lý do: ${reason.trim()}`
    });

    saveDb();

    res.json({
      success: true,
      message: 'Hủy đơn hàng thành công.',
      data: order
    });
  } catch (error) {
    console.error('Lỗi hủy đơn hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy đơn hàng.' });
  }
});

// 5. Quản trị viên: Lấy toàn bộ đơn hàng hệ thống
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

// 6. Quản trị viên: Lấy thống kê đơn hàng
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
      ready: orders.filter(o => o.status === 'ready').length,
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

// 7. Quản trị viên: Cập nhật trạng thái đơn hàng (7 bước chuẩn)
// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const { status, note } = req.body;

    if (!VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Cho phép: ${VALID_ORDER_STATUSES.join(', ')}`
      });
    }

    const order = (db.orders || []).find(o => o.id === orderId || o.code === orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const statusMessages = {
      pending: 'Chờ xác nhận',
      confirmed: 'Quán ăn đã xác nhận đơn hàng',
      preparing: 'Quán ăn đang chuẩn bị món',
      ready: 'Món ăn đã chuẩn bị xong, sẵn sàng giao cho tài xế',
      shipping: 'Tài xế đang giao hàng',
      completed: 'Giao hàng thành công (Hoàn tất)',
      cancelled: 'Đơn hàng đã bị hủy'
    };

    // Nếu chuyển sang hủy bởi admin, hoàn lại coupon
    if (status === 'cancelled' && order.status !== 'cancelled' && order.couponCode && Array.isArray(db.coupons)) {
      const coupon = db.coupons.find(c => c.code.toUpperCase() === order.couponCode.toUpperCase());
      if (coupon) {
        coupon.usedCount = Math.max(0, (coupon.usedCount || 1) - 1);
        if (Array.isArray(coupon.usedBy)) {
          coupon.usedBy = coupon.usedBy.filter(u => u.orderCode !== order.code);
        }
      }
      order.cancelledBy = 'Quản trị viên';
      order.cancelledAt = new Date().toISOString();
      if (note) order.cancelReason = note;
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (status === 'completed') {
      order.paymentStatus = 'paid';
    }

    if (!Array.isArray(order.timeline)) {
      order.timeline = [];
    }

    order.timeline.push({
      status,
      time: new Date().toISOString(),
      message: note ? `Trạng thái: ${statusMessages[status]} (${note})` : statusMessages[status]
    });

    saveDb();

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn sang: ${statusMessages[status]}`,
      data: order
    });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái đơn:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật đơn hàng.' });
  }
});

export default router;
