import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

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
      const dishId = Number(item.dishId || item.id);
      const dishInMenu = (restaurant.menu || []).find(m => m.id === dishId);

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

      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (quantity > 99) {
        return res.status(400).json({
          success: false,
          message: `Số lượng món "${dishInMenu.name}" vượt quá giới hạn đặt tối đa (99 suất).`
        });
      }

      // Lấy giá chuẩn từ cơ sở dữ liệu backend
      const unitPrice = dishInMenu.priceNum || 0;
      if (unitPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: `Món "${dishInMenu.name}" có giá không hợp lệ để đặt hàng trực tuyến.`
        });
      }

      const itemTotal = unitPrice * quantity;
      subtotal += itemTotal;

      verifiedItems.push({
        dishId: dishInMenu.id,
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
      deliveryAddress: deliveryAddress.trim(),
      note: note ? note.trim() : '',
      items: verifiedItems,
      totalItems: verifiedItems.reduce((acc, cur) => acc + cur.quantity, 0),
      subtotal,
      shippingFee,
      discount,
      couponCode: appliedCoupon,
      total,
      paymentMethod: paymentMethod === 'COD' ? 'COD' : 'COD',
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

// 4. Khách hàng yêu cầu hủy đơn hàng (chỉ khi đơn còn ở trạng thái pending)
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

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng đã được xác nhận hoặc đang chuẩn bị, không thể tự hủy. Vui lòng liên hệ hotline quán.'
      });
    }

    order.status = 'cancelled';
    order.cancelReason = reason;
    order.updatedAt = new Date().toISOString();
    order.timeline.push({
      status: 'cancelled',
      time: new Date().toISOString(),
      message: `Đơn hàng đã bị hủy. Lý do: ${reason}`
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

// 7. Quản trị viên: Cập nhật trạng thái đơn hàng
// PATCH /api/orders/:id/status
router.patch('/:id/status', authenticateToken, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const orderId = req.params.id;
    const { status, note } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'shipping', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái không hợp lệ. Cho phép: ${validStatuses.join(', ')}`
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
      shipping: 'Tài xế đang giao hàng',
      completed: 'Giao hàng thành công (Hoàn tất)',
      cancelled: 'Đơn hàng đã bị hủy'
    };

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

