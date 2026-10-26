import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Helper chuẩn hóa các món trong giỏ hàng (tự động phân giải ID cho giỏ hàng cũ)
function sanitizeCartItems(items, restaurantId, db) {
  if (!Array.isArray(items)) return [];
  const rest = restaurantId ? db.restaurants.find(r => r.id === Number(restaurantId)) : null;

  return items.map(item => {
    const rawDishId = item.dishId !== undefined ? item.dishId : (item.id !== undefined ? item.id : (item.foodId || item.menuItemId));
    let dishId = (rawDishId !== null && rawDishId !== undefined && !isNaN(Number(rawDishId))) ? Number(rawDishId) : null;

    // Nếu thiếu ID nhưng có nhà hàng, tìm món trong thực đơn theo tên
    if (dishId === null && rest && Array.isArray(rest.menu)) {
      const match = rest.menu.find(m => m.name && item.name && m.name.trim().toLowerCase() === item.name.trim().toLowerCase());
      if (match && match.id) {
        dishId = Number(match.id);
      }
    }

    const priceNum = (typeof item.priceNum === 'number' && item.priceNum > 0)
      ? item.priceNum
      : (parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10) || 0);

    return {
      dishId,
      id: dishId,
      name: item.name || '',
      price: item.price || (priceNum ? `${priceNum.toLocaleString('vi-VN')} đ` : '0 đ'),
      priceNum,
      image: item.image || '',
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      note: item.note ? String(item.note).trim() : ''
    };
  });
}

// Lấy giỏ hàng của người dùng hiện tại
// GET /api/cart
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    let userCart = db.carts.find(c => c.userId === req.user.id);

    if (userCart) {
      userCart.items = sanitizeCartItems(userCart.items, userCart.restaurantId, db);
    }

    res.json({
      success: true,
      data: userCart || {
        userId: req.user.id,
        restaurantId: null,
        restaurantName: '',
        restaurantAddress: '',
        items: [],
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Lỗi lấy giỏ hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy giỏ hàng.' });
  }
});

// Lưu / Cập nhật giỏ hàng của người dùng
// POST /api/cart
router.post('/', authenticateToken, (req, res) => {
  try {
    const { items, restaurantId, restaurantName, restaurantAddress } = req.body;
    const db = getDb();

    let userCart = db.carts.find(c => c.userId === req.user.id);
    const targetRestId = restaurantId || (userCart ? userCart.restaurantId : null);
    const sanitized = sanitizeCartItems(items, targetRestId, db);

    if (!userCart) {
      userCart = {
        userId: req.user.id,
        restaurantId: targetRestId ? Number(targetRestId) : null,
        restaurantName: restaurantName || '',
        restaurantAddress: restaurantAddress || '',
        items: sanitized,
        updatedAt: new Date().toISOString()
      };
      db.carts.push(userCart);
    } else {
      userCart.restaurantId = sanitized.length > 0 ? (targetRestId ? Number(targetRestId) : userCart.restaurantId) : null;
      userCart.restaurantName = sanitized.length > 0 ? (restaurantName || userCart.restaurantName) : '';
      userCart.restaurantAddress = sanitized.length > 0 ? (restaurantAddress || userCart.restaurantAddress) : '';
      userCart.items = sanitized;
      userCart.updatedAt = new Date().toISOString();
    }

    saveDb();

    res.json({
      success: true,
      message: 'Cập nhật giỏ hàng thành công.',
      data: userCart
    });
  } catch (error) {
    console.error('Lỗi cập nhật giỏ hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật giỏ hàng.' });
  }
});

// Xóa toàn bộ giỏ hàng của người dùng
// DELETE /api/cart
router.delete('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const index = db.carts.findIndex(c => c.userId === req.user.id);

    if (index !== -1) {
      db.carts[index].items = [];
      db.carts[index].restaurantId = null;
      db.carts[index].restaurantName = '';
      db.carts[index].restaurantAddress = '';
      db.carts[index].updatedAt = new Date().toISOString();
      saveDb();
    }

    res.json({
      success: true,
      message: 'Đã làm trống giỏ hàng.'
    });
  } catch (error) {
    console.error('Lỗi xóa giỏ hàng:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa giỏ hàng.' });
  }
});

export default router;

