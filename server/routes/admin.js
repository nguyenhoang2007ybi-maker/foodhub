import { Router } from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Toàn bộ các routes trong admin đều yêu cầu authenticateToken + requireAdmin
router.use(authenticateToken, requireAdmin);

// Thống kê tổng quan Dashboard
// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const db = getDb();

  const totalUsers = db.users ? db.users.length : 0;
  const totalRestaurants = db.restaurants ? db.restaurants.length : 0;
  const totalCategories = db.categories ? db.categories.length : 0;
  const totalReviews = db.reviews ? db.reviews.length : 0;
  const pendingReviews = db.reviews ? db.reviews.filter(r => r.status === 'pending').length : 0;

  // Phân bố đánh giá theo sao
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (Array.isArray(db.reviews)) {
    db.reviews.forEach(r => {
      const star = Math.round(Number(r.rating) || 5);
      if (star >= 1 && star <= 5) {
        ratingDistribution[star] = (ratingDistribution[star] || 0) + 1;
      }
    });
  }

  // Top 5 quán ăn đánh giá cao nhất
  const topRestaurants = [...(db.restaurants || [])]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      reviewsCount: r.reviewsCount,
      category: r.category,
      price: r.price,
      image: r.image
    }));

  // Hoạt động mới nhất: 5 đánh giá mới nhất + 5 người dùng mới đăng ký
  const recentReviews = [...(db.reviews || [])]
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
    .slice(0, 5)
    .map(r => {
      const rest = db.restaurants.find(res => res.id === r.restaurantId);
      return {
        id: r.id,
        userName: r.userName,
        userAvatar: r.userAvatar,
        restaurantName: rest ? rest.name : 'Quán đã xóa',
        rating: r.rating,
        content: r.content,
        status: r.status,
        date: r.date || r.createdAt
      };
    });

  const recentUsers = [...(db.users || [])]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt
    }));

  res.json({
    success: true,
    data: {
      totalUsers,
      totalRestaurants,
      totalCategories,
      totalReviews,
      pendingReviews,
      ratingDistribution,
      topRestaurants,
      recentReviews,
      recentUsers
    }
  });
});

// Lấy danh sách tài khoản
// GET /api/admin/users
router.get('/users', (req, res) => {
  const db = getDb();
  const { search, role, status } = req.query;

  let users = (db.users || []).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status || 'active',
    avatar: u.avatar,
    createdAt: u.createdAt
  }));

  if (search) {
    const q = search.toLowerCase();
    users = users.filter(u => 
      u.name.toLowerCase().includes(q) || 
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q))
    );
  }

  if (role) {
    users = users.filter(u => u.role === role);
  }

  if (status) {
    users = users.filter(u => u.status === status);
  }

  res.json({
    success: true,
    data: users,
    total: users.length
  });
});

// Cập nhật trạng thái và vai trò của tài khoản
// PUT /api/admin/users/:id
router.put('/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  const { role, status } = req.body;
  const db = getDb();

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
  }

  // Bảo vệ: Admin không được tự khóa tài khoản của chính mình
  if (user.id === req.user.id && status === 'blocked') {
    return res.status(400).json({
      success: false,
      message: 'Bạn không thể tự khóa tài khoản của chính mình.'
    });
  }

  // Bảo vệ: Không được hạ quyền nếu là tài khoản admin duy nhất
  if (user.role === 'admin' && role === 'customer') {
    const adminCount = db.users.filter(u => u.role === 'admin' && u.status !== 'blocked').length;
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Hệ thống cần ít nhất một tài khoản Quản trị viên đang hoạt động.'
      });
    }
  }

  if (role && ['admin', 'customer'].includes(role)) {
    user.role = role;
  }

  if (status && ['active', 'blocked'].includes(status)) {
    user.status = status;
  }

  user.updatedAt = new Date().toISOString();
  saveDb();

  res.json({
    success: true,
    message: 'Cập nhật thông tin tài khoản thành công.',
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status
    }
  });
});

// Xóa tài khoản
// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  const db = getDb();

  const index = db.users.findIndex(u => u.id === userId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
  }

  const user = db.users[index];

  // Chính sách hệ thống: Admin KHÔNG được xóa tài khoản khách hàng
  if (user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Không thể xóa tài khoản khách hàng. Hãy dùng trạng thái "Đã bị khóa" thay thế.'
    });
  }

  // Không cho tự xóa chính mình
  if (userId === req.user.id) {
    return res.status(400).json({
      success: false,
      message: 'Bạn không thể tự xóa tài khoản của chính mình.'
    });
  }

  // Không cho xóa admin cuối cùng
  const adminCount = db.users.filter(u => u.role === 'admin').length;
  if (adminCount <= 1) {
    return res.status(400).json({
      success: false,
      message: 'Không thể xóa tài khoản Quản trị viên cuối cùng trong hệ thống.'
    });
  }

  db.users.splice(index, 1);
  // Đồng thời dọn dẹp favorites của user này
  if (Array.isArray(db.favorites)) {
    db.favorites = db.favorites.filter(f => f.userId !== userId);
  }
  saveDb();

  res.json({
    success: true,
    message: 'Đã xóa tài khoản người dùng thành công.'
  });
});

// Cập nhật cài đặt hệ thống
// PUT /api/admin/settings
router.put('/settings', (req, res) => {
  const db = getDb();
  if (!db.settings) db.settings = {};

  const allowedFields = ['siteName', 'slogan', 'hotline', 'email', 'address', 'description', 'logoUrl'];
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      db.settings[field] = req.body[field];
    }
  });

  saveDb();
  res.json({
    success: true,
    message: 'Cập nhật cài đặt hệ thống thành công.',
    data: db.settings
  });
});

export default router;

