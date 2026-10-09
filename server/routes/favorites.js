import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Lấy danh sách quán ăn yêu thích của người dùng hiện tại
// GET /api/favorites
router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  if (!Array.isArray(db.favorites)) {
    db.favorites = [];
  }

  const userFavorites = db.favorites.filter(f => f.userId === req.user.id);
  const restaurantIds = userFavorites.map(f => f.restaurantId);

  // Lấy chi tiết các quán ăn
  const favoriteRestaurants = db.restaurants
    .filter(r => restaurantIds.includes(r.id))
    .map(r => ({
      ...r,
      isFavorite: true
    }));

  res.json({
    success: true,
    data: favoriteRestaurants,
    total: favoriteRestaurants.length
  });
});

// Lấy danh sách ID các quán ăn yêu thích (cho việc highlight icon tim nhanh)
// GET /api/favorites/ids
router.get('/ids', authenticateToken, (req, res) => {
  const db = getDb();
  if (!Array.isArray(db.favorites)) {
    db.favorites = [];
  }

  const ids = db.favorites
    .filter(f => f.userId === req.user.id)
    .map(f => f.restaurantId);

  res.json({
    success: true,
    data: ids
  });
});

// Bật/tắt yêu thích (Toggle)
// POST /api/favorites/toggle
router.post('/toggle', authenticateToken, (req, res) => {
  const { restaurantId } = req.body;
  const restId = Number(restaurantId);

  if (!restId || isNaN(restId)) {
    return res.status(400).json({ success: false, message: 'ID quán ăn không hợp lệ.' });
  }

  const db = getDb();
  if (!Array.isArray(db.favorites)) {
    db.favorites = [];
  }

  const restaurant = db.restaurants.find(r => r.id === restId);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Quán ăn không tồn tại.' });
  }

  const existingIndex = db.favorites.findIndex(f => f.userId === req.user.id && f.restaurantId === restId);

  if (existingIndex !== -1) {
    // Đã thích -> Bỏ thích
    db.favorites.splice(existingIndex, 1);
    saveDb();
    return res.json({
      success: true,
      isFavorite: false,
      message: `Đã xóa "${restaurant.name}" khỏi danh sách yêu thích.`
    });
  } else {
    // Chưa thích -> Thêm vào yêu thích
    const newId = db.favorites.length > 0 ? Math.max(...db.favorites.map(f => Number(f.id) || 0)) + 1 : 1;
    db.favorites.push({
      id: newId,
      userId: req.user.id,
      restaurantId: restId,
      createdAt: new Date().toISOString()
    });
    saveDb();
    return res.json({
      success: true,
      isFavorite: true,
      message: `Đã thêm "${restaurant.name}" vào danh sách yêu thích.`
    });
  }
});

// Xóa khỏi danh sách yêu thích theo restaurantId
// DELETE /api/favorites/:restaurantId
router.delete('/:restaurantId', authenticateToken, (req, res) => {
  const restId = Number(req.params.restaurantId);
  const db = getDb();
  if (!Array.isArray(db.favorites)) {
    db.favorites = [];
  }

  const index = db.favorites.findIndex(f => f.userId === req.user.id && f.restaurantId === restId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Quán ăn chưa có trong danh sách yêu thích.' });
  }

  db.favorites.splice(index, 1);
  saveDb();

  res.json({
    success: true,
    message: 'Đã xóa khỏi danh sách yêu thích thành công.'
  });
});

export default router;

