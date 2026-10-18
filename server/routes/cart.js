import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Lấy giỏ hàng của người dùng hiện tại
// GET /api/cart
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const userCart = db.carts.find(c => c.userId === req.user.id);

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
    const validItems = Array.isArray(items) ? items : [];

    if (!userCart) {
      userCart = {
        userId: req.user.id,
        restaurantId: restaurantId || null,
        restaurantName: restaurantName || '',
        restaurantAddress: restaurantAddress || '',
        items: validItems,
        updatedAt: new Date().toISOString()
      };
      db.carts.push(userCart);
    } else {
      userCart.restaurantId = validItems.length > 0 ? (restaurantId || userCart.restaurantId) : null;
      userCart.restaurantName = validItems.length > 0 ? (restaurantName || userCart.restaurantName) : '';
      userCart.restaurantAddress = validItems.length > 0 ? (restaurantAddress || userCart.restaurantAddress) : '';
      userCart.items = validItems;
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

