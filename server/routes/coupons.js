import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Helper tính toán mức giảm của coupon
export function calculateCouponDiscount(coupon, subtotal, shippingFee = 15000) {
  let discount = 0;
  if (!coupon) return 0;

  const numSubtotal = Math.max(0, Number(subtotal) || 0);
  const numShip = Math.max(0, Number(shippingFee) || 0);

  if (coupon.type === 'percent') {
    const rawDiscount = Math.round((numSubtotal * Number(coupon.value || 0)) / 100);
    const max = Number(coupon.maxDiscount);
    discount = (max && max > 0) ? Math.min(rawDiscount, max) : rawDiscount;
    discount = Math.min(numSubtotal, discount);
  } else if (coupon.type === 'fixed') {
    const val = Math.max(0, Number(coupon.value || 0));
    discount = Math.min(numSubtotal, val);
  } else if (coupon.type === 'freeship') {
    const max = Number(coupon.maxDiscount);
    const cap = (max && max > 0) ? Math.min(numShip, max) : numShip;
    discount = Math.min(numShip, cap);
  }
  return Math.max(0, discount);
}

// Helper xác thực coupon
export function validateCouponLogic(coupon, { subtotal = 0, restaurantId, userId }) {
  if (!coupon) {
    return { valid: false, message: 'Mã giảm giá không tồn tại.' };
  }

  if (coupon.isActive === false) {
    return { valid: false, message: 'Mã giảm giá này hiện đang tạm ngưng áp dụng.' };
  }

  const now = new Date();
  if (coupon.startDate) {
    let start;
    if (typeof coupon.startDate === 'string' && coupon.startDate.length <= 10) {
      const parts = coupon.startDate.split('-').map(Number);
      if (parts.length === 3) {
        start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      } else {
        start = new Date(coupon.startDate);
      }
    } else {
      start = new Date(coupon.startDate);
    }
    if (start > now) {
      return { valid: false, message: 'Mã giảm giá chưa đến ngày áp dụng.' };
    }
  }

  if (coupon.endDate) {
    let end;
    if (typeof coupon.endDate === 'string' && coupon.endDate.length <= 10) {
      const parts = coupon.endDate.split('-').map(Number);
      if (parts.length === 3) {
        end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      } else {
        end = new Date(coupon.endDate);
      }
    } else {
      end = new Date(coupon.endDate);
    }
    if (end < now) {
      return { valid: false, message: 'Mã giảm giá đã hết hạn sử dụng.' };
    }
  }

  const minOrder = Number(coupon.minOrder) || 0;
  if (Number(subtotal) < minOrder) {
    return {
      valid: false,
      message: `Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')} đ để sử dụng mã này.`
    };
  }

  const totalLimit = Number(coupon.totalLimit);
  const usedCount = Number(coupon.usedCount) || 0;
  if (!isNaN(totalLimit) && totalLimit > 0 && usedCount >= totalLimit) {
    return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng.' };
  }

  // Giới hạn lượt dùng của từng người dùng
  if (userId) {
    const perUserLimit = Number(coupon.perUserLimit) || 1;
    const userUsedCount = (coupon.usedBy || []).filter(u => String(u.userId) === String(userId)).length;
    if (userUsedCount >= perUserLimit) {
      return {
        valid: false,
        message: `Bạn đã sử dụng mã này ${userUsedCount}/${perUserLimit} lần (đã đạt giới hạn tối đa).`
      };
    }
  }

  // Phạm vi áp dụng (all hoặc quán chỉ định)
  if (coupon.scope && coupon.scope !== 'all' && restaurantId) {
    const restIdNum = Number(restaurantId);
    const scopeNum = Number(coupon.scope);
    if (!isNaN(scopeNum) && scopeNum !== restIdNum) {
      return {
        valid: false,
        message: 'Mã ưu đãi này chỉ áp dụng cho quán ăn được chỉ định.'
      };
    }
  }

  return { valid: true };
}

// 1. Danh sách mã giảm giá công khai gợi ý cho khách hàng
// GET /api/coupons/public
router.get('/public', (req, res) => {
  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const now = new Date();
  const publicCoupons = db.coupons
    .filter(c => {
      if (c.isActive === false) return false;
      if (c.startDate) {
        let start;
        if (typeof c.startDate === 'string' && c.startDate.length <= 10) {
          const parts = c.startDate.split('-').map(Number);
          if (parts.length === 3) start = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
          else start = new Date(c.startDate);
        } else {
          start = new Date(c.startDate);
        }
        if (start > now) return false;
      }
      if (c.endDate) {
        let end;
        if (typeof c.endDate === 'string' && c.endDate.length <= 10) {
          const parts = c.endDate.split('-').map(Number);
          if (parts.length === 3) end = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
          else end = new Date(c.endDate);
        } else {
          end = new Date(c.endDate);
        }
        if (end < now) return false;
      }
      const totalLimit = Number(c.totalLimit);
      if (!isNaN(totalLimit) && totalLimit > 0 && (c.usedCount || 0) >= totalLimit) return false;
      return true;
    })
    .map(c => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      maxDiscount: c.maxDiscount,
      minOrder: c.minOrder,
      description: c.description,
      scope: c.scope,
      endDate: c.endDate
    }));

  res.json({
    success: true,
    data: publicCoupons
  });
});

// 2. Kiểm tra và áp dụng mã giảm giá
// POST /api/coupons/validate
router.post('/validate', optionalAuth, (req, res) => {
  const { code, subtotal = 0, restaurantId } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá.' });
  }

  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const cleanCode = code.trim().toUpperCase();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === cleanCode);

  const check = validateCouponLogic(coupon, {
    subtotal: Number(subtotal) || 0,
    restaurantId,
    userId: req.user ? req.user.id : null
  });

  if (!check.valid) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: check.message
    });
  }

  const subtotalNum = Number(subtotal) || 0;
  const shippingFee = subtotalNum >= 200000 ? 0 : 15000;
  const discount = calculateCouponDiscount(coupon, subtotalNum, shippingFee);

  res.json({
    success: true,
    valid: true,
    discount,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscount: coupon.maxDiscount,
      minOrder: coupon.minOrder,
      description: coupon.description
    },
    message: `Áp dụng thành công mã ${coupon.code}! Giảm ${discount.toLocaleString('vi-VN')} đ.`
  });
});

// ==================== QUẢN LÝ DÀNH CHO ADMIN ====================

// 3. Admin: Lấy danh sách toàn bộ mã giảm giá
// GET /api/coupons/admin/all
router.get('/admin/all', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const coupons = [...db.coupons].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  res.json({
    success: true,
    data: coupons,
    total: coupons.length
  });
});

// 4. Admin: Thêm mới mã giảm giá
// POST /api/coupons/admin
router.post('/admin', authenticateToken, requireAdmin, (req, res) => {
  const {
    code,
    type,
    value,
    maxDiscount,
    minOrder,
    startDate,
    endDate,
    totalLimit,
    perUserLimit,
    scope,
    description,
    isActive = true
  } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, message: 'Mã giảm giá không được để trống.' });
  }

  const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const exists = db.coupons.some(c => c.code.toUpperCase() === cleanCode);
  if (exists) {
    return res.status(400).json({ success: false, message: `Mã giảm giá "${cleanCode}" đã tồn tại.` });
  }

  if (!['percent', 'fixed', 'freeship'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Loại giảm giá phải là percent, fixed hoặc freeship.' });
  }

  const numValue = Number(value) || 0;
  if (type === 'percent' && (numValue <= 0 || numValue > 100)) {
    return res.status(400).json({ success: false, message: 'Phần trăm giảm giá phải từ 1 đến 100.' });
  }

  const newId = db.coupons.length > 0 ? Math.max(...db.coupons.map(c => Number(c.id) || 0)) + 1 : 1;

  const newCoupon = {
    id: newId,
    code: cleanCode,
    type,
    value: numValue,
    maxDiscount: Number(maxDiscount) || (type === 'percent' ? 50000 : numValue),
    minOrder: Number(minOrder) || 0,
    startDate: startDate || new Date().toISOString().split('T')[0],
    endDate: endDate || '',
    totalLimit: totalLimit ? Number(totalLimit) : 100,
    perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
    scope: scope || 'all',
    description: description ? description.trim() : `Mã ưu đãi ${cleanCode}`,
    isActive: Boolean(isActive),
    usedCount: 0,
    usedBy: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.coupons.push(newCoupon);
  saveDb();

  res.status(201).json({
    success: true,
    message: `Đã tạo mã ưu đãi ${newCoupon.code} thành công!`,
    data: newCoupon
  });
});

// 5. Admin: Chỉnh sửa mã giảm giá
// PUT /api/coupons/admin/:id
router.put('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const couponId = Number(req.params.id);
  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const coupon = db.coupons.find(c => Number(c.id) === couponId);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá.' });
  }

  const {
    code,
    type,
    value,
    maxDiscount,
    minOrder,
    startDate,
    endDate,
    totalLimit,
    perUserLimit,
    scope,
    description,
    isActive
  } = req.body;

  if (code) {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const duplicate = db.coupons.some(c => Number(c.id) !== couponId && c.code.toUpperCase() === cleanCode);
    if (duplicate) {
      return res.status(400).json({ success: false, message: `Mã "${cleanCode}" đã trùng với mã khác.` });
    }
    coupon.code = cleanCode;
  }

  if (type && ['percent', 'fixed', 'freeship'].includes(type)) {
    coupon.type = type;
  }
  if (value !== undefined) {
    coupon.value = Number(value) || 0;
  }
  if (maxDiscount !== undefined) {
    coupon.maxDiscount = Number(maxDiscount) || 0;
  }
  if (minOrder !== undefined) {
    coupon.minOrder = Number(minOrder) || 0;
  }
  if (startDate !== undefined) coupon.startDate = startDate;
  if (endDate !== undefined) coupon.endDate = endDate;
  if (totalLimit !== undefined) coupon.totalLimit = Number(totalLimit);
  if (perUserLimit !== undefined) coupon.perUserLimit = Number(perUserLimit);
  if (scope !== undefined) coupon.scope = scope;
  if (description !== undefined) coupon.description = description.trim();
  if (isActive !== undefined) coupon.isActive = Boolean(isActive);

  coupon.updatedAt = new Date().toISOString();
  saveDb();

  res.json({
    success: true,
    message: 'Cập nhật mã giảm giá thành công!',
    data: coupon
  });
});

// 6. Admin: Bật/Tắt trạng thái hoạt động của mã
// PATCH /api/coupons/admin/:id/status
router.patch('/admin/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const couponId = Number(req.params.id);
  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const coupon = db.coupons.find(c => Number(c.id) === couponId);
  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá.' });
  }

  coupon.isActive = !coupon.isActive;
  coupon.updatedAt = new Date().toISOString();
  saveDb();

  res.json({
    success: true,
    message: `Đã ${coupon.isActive ? 'kích hoạt' : 'tạm ngưng'} mã ${coupon.code}.`,
    data: coupon
  });
});

// 7. Admin: Xóa mã giảm giá
// DELETE /api/coupons/admin/:id
router.delete('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const couponId = Number(req.params.id);
  const db = getDb();
  if (!Array.isArray(db.coupons)) db.coupons = [];

  const index = db.coupons.findIndex(c => Number(c.id) === couponId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá.' });
  }

  const removed = db.coupons.splice(index, 1)[0];
  saveDb();

  res.json({
    success: true,
    message: `Đã xóa mã ưu đãi ${removed.code} thành công.`
  });
});

export default router;

