import { Router } from 'express';
import { getDb, saveDb, recalculateRestaurantRating } from '../db.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Lấy danh sách đánh giá của một quán ăn
// GET /api/reviews/restaurant/:restaurantId
router.get('/restaurant/:restaurantId', optionalAuth, (req, res) => {
  const restaurantId = Number(req.params.restaurantId);
  const db = getDb();

  const restaurant = db.restaurants.find(r => r.id === restaurantId);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy quán ăn.' });
  }

  // Hiển thị công khai tất cả đánh giá hợp lệ (không bị ẩn hoặc từ chối)
  let reviews = db.reviews.filter(r => Number(r.restaurantId || r.restaurant_id) === restaurantId && r.status !== 'hidden' && r.status !== 'rejected');

  // Sắp xếp mới nhất lên trước
  reviews.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  res.json({
    success: true,
    data: reviews,
    total: reviews.length
  });
});

// Lấy danh sách đánh giá của chính người dùng đang đăng nhập
// GET /api/reviews/my
router.get('/my', authenticateToken, (req, res) => {
  const db = getDb();
  const myReviews = db.reviews.filter(r => r.userId === req.user.id);

  // Gắn kèm tên quán ăn và ảnh đại diện quán
  const enrichedReviews = myReviews.map(r => {
    const restaurant = db.restaurants.find(rest => rest.id === r.restaurantId);
    return {
      ...r,
      restaurantName: restaurant ? restaurant.name : 'Quán ăn',
      restaurantImage: restaurant ? restaurant.image : ''
    };
  });

  enrichedReviews.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  res.json({
    success: true,
    data: enrichedReviews,
    total: enrichedReviews.length
  });
});

// Thêm mới đánh giá
// POST /api/reviews
router.post('/', authenticateToken, (req, res) => {
  const { restaurantId, rating, content, images } = req.body;

  if (!restaurantId || !rating || !content) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng cung cấp quán ăn, số sao và nội dung đánh giá.'
    });
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Số sao đánh giá phải từ 1 đến 5.'
    });
  }

  if (content.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'Nội dung đánh giá cần tối thiểu 5 ký tự.'
    });
  }

  const db = getDb();
  const restId = Number(restaurantId);
  const restaurant = db.restaurants.find(r => r.id === restId);
  if (!restaurant) {
    return res.status(404).json({ success: false, message: 'Quán ăn không tồn tại.' });
  }

  // Mỗi lần gửi là một bình luận mới: không tìm/gộp/ghi đè bình luận cũ của người dùng.
  // Chống spam: Chặn gửi liên tục nội dung y hệt nhau trong vòng 30 giây bởi cùng người dùng
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const isSpam = db.reviews.some(r =>
    r.userId === req.user.id &&
    r.restaurantId === restId &&
    r.content.trim().toLowerCase() === content.trim().toLowerCase() &&
    new Date(r.createdAt || r.date) > thirtySecondsAgo
  );
  if (isSpam) {
    return res.status(429).json({
      success: false,
      spam: true,
      message: 'Bạn vừa gửi đánh giá với nội dung này. Vui lòng chờ 30 giây trước khi gửi tiếp.'
    });
  }

  const newId = db.reviews.length > 0 ? Math.max(...db.reviews.map(r => Number(r.id) || 0)) + 1 : 1;
  const newReview = {
    id: newId,
    restaurantId: restId,
    userId: req.user.id,
    userName: req.user.name,
    userAvatar: req.user.avatar || '',
    rating: numRating,
    content: content.trim(),
    images: Array.isArray(images) ? images : [],
    status: 'approved',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };

  db.reviews.push(newReview);
  saveDb();
  recalculateRestaurantRating(restId);

  res.status(201).json({
    success: true,
    message: 'Đánh giá của bạn đã được đăng thành công!',
    data: newReview
  });
});

// Chỉnh sửa đánh giá (chỉ người tạo hoặc admin)
// PUT /api/reviews/:id
router.put('/:id', authenticateToken, (req, res) => {
  const reviewId = Number(req.params.id);
  const { rating, content, images } = req.body;
  const db = getDb();

  const review = db.reviews.find(r => r.id === reviewId);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
  }

  if (Number(review.userId) !== Number(req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền chỉnh sửa đánh giá này.'
    });
  }

  if (rating !== undefined) {
    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Số sao đánh giá phải từ 1 đến 5.' });
    }
    review.rating = numRating;
  }

  if (content !== undefined) {
    if (content.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Nội dung đánh giá cần tối thiểu 5 ký tự.' });
    }
    review.content = content.trim();
  }

  if (Array.isArray(images)) {
    review.images = images;
  }

  review.updatedAt = new Date().toISOString();
  saveDb();
  recalculateRestaurantRating(review.restaurantId);

  res.json({
    success: true,
    message: 'Chỉnh sửa đánh giá thành công.',
    data: review
  });
});

// Xóa đánh giá (chỉ người tạo hoặc admin)
// DELETE /api/reviews/:id
router.delete('/:id', authenticateToken, (req, res) => {
  const reviewId = Number(req.params.id);
  const db = getDb();

  const index = db.reviews.findIndex(r => r.id === reviewId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
  }

  const review = db.reviews[index];
  if (Number(review.userId) !== Number(req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xóa đánh giá này.'
    });
  }

  const restId = review.restaurantId;
  db.reviews.splice(index, 1);
  saveDb();
  recalculateRestaurantRating(restId);

  res.json({
    success: true,
    message: 'Đã xóa đánh giá thành công.'
  });
});

// Admin: Lấy toàn bộ đánh giá trong hệ thống
// GET /api/reviews/admin/all
router.get('/admin/all', authenticateToken, requireAdmin, (req, res) => {
  const db = getDb();
  const { status, restaurantId } = req.query;

  let reviews = [...db.reviews];
  if (status) {
    reviews = reviews.filter(r => r.status === status);
  }
  if (restaurantId) {
    reviews = reviews.filter(r => r.restaurantId === Number(restaurantId));
  }

  // Enriched with restaurant names
  const enriched = reviews.map(r => {
    const restaurant = db.restaurants.find(rest => rest.id === r.restaurantId);
    return {
      ...r,
      restaurantName: restaurant ? restaurant.name : 'Quán đã xóa'
    };
  });

  enriched.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  res.json({
    success: true,
    data: enriched,
    total: enriched.length
  });
});

// Admin: Cập nhật trạng thái duyệt đánh giá (approved, pending, hidden)
// PATCH /api/reviews/:id/status
router.patch('/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const reviewId = Number(req.params.id);
  const { status } = req.body;

  if (!['approved', 'pending', 'rejected', 'hidden'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Trạng thái không hợp lệ (approved, pending, rejected, hidden).'
    });
  }

  const db = getDb();
  const review = db.reviews.find(r => r.id === reviewId);
  if (!review) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
  }

  review.status = status;
  review.updatedAt = new Date().toISOString();
  saveDb();
  recalculateRestaurantRating(review.restaurantId);

  res.json({
    success: true,
    message: `Đã chuyển trạng thái đánh giá sang: ${status}`,
    data: review
  });
});

export default router;

