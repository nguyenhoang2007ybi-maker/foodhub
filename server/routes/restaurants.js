import express from 'express';
import { getDb, saveDb, recalculateRestaurantRating } from '../db.js';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const match = priceStr.replace(/\./g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// 1. Lấy danh sách quán ăn
router.get('/', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    let list = [...db.restaurants];

    const {
      q,
      search,
      category,
      area,
      priceRange,
      minRating,
      sort,
      featured,
      page = 1,
      limit = 9
    } = req.query;

    const queryStr = (q || search || '').toLowerCase().trim();

    if (queryStr) {
      list = list.filter(r => {
        const inName = r.name && r.name.toLowerCase().includes(queryStr);
        const inCategory = r.category && r.category.toLowerCase().includes(queryStr);
        const inAddress = r.address && r.address.toLowerCase().includes(queryStr);
        const inDesc = r.description && r.description.toLowerCase().includes(queryStr);
        const inMenu = Array.isArray(r.menu) && r.menu.some(m => m.name && m.name.toLowerCase().includes(queryStr));
        return inName || inCategory || inAddress || inDesc || inMenu;
      });
    }

    if (category && category !== 'all' && category !== 'Tất cả') {
      list = list.filter(r => r.category && r.category.toLowerCase() === category.toLowerCase());
    }

    if (area && area !== 'all') {
      list = list.filter(r => (r.area && r.area.toLowerCase().includes(area.toLowerCase())) ||
                              (r.address && r.address.toLowerCase().includes(area.toLowerCase())));
    }

    if (priceRange) {
      if (priceRange === 'under-50k') {
        list = list.filter(r => (r.minPrice && r.minPrice <= 50000) || parsePrice(r.price) <= 50000);
      } else if (priceRange === '50k-100k') {
        list = list.filter(r => ((r.minPrice && r.minPrice >= 50000) || parsePrice(r.price) >= 50000) &&
                                ((r.maxPrice && r.maxPrice <= 150000) || parsePrice(r.price) <= 150000));
      } else if (priceRange === 'over-100k') {
        list = list.filter(r => (r.maxPrice && r.maxPrice >= 100000) || parsePrice(r.price) >= 100000);
      }
    }

    if (minRating) {
      const rNum = parseFloat(minRating);
      if (!isNaN(rNum)) {
        list = list.filter(r => Number(r.rating || 0) >= rNum);
      }
    }

    if (featured === 'true') {
      list = list.filter(r => r.featured === true);
    }

    if (sort === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'reviews') {
      list.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));
    } else if (sort === 'price_asc') {
      list.sort((a, b) => (a.minPrice || parsePrice(a.price)) - (b.minPrice || parsePrice(b.price)));
    } else if (sort === 'price_desc') {
      list.sort((a, b) => (b.maxPrice || parsePrice(b.price)) - (a.maxPrice || parsePrice(a.price)));
    } else if (sort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    const total = list.length;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = limit === 'all' ? total : (parseInt(limit, 10) || 9);
    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = limit === 'all' ? list : list.slice(startIndex, startIndex + limitNum);

    let favoriteIds = [];
    if (req.user) {
      favoriteIds = db.favorites.filter(f => f.userId === req.user.id).map(f => f.restaurantId);
    }

    const result = paginatedItems.map(item => ({
      ...item,
      isFavorite: favoriteIds.includes(item.id)
    }));

    res.json({
      success: true,
      data: result,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách quán ăn:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách quán ăn.' });
  }
});

// 2. Lấy chi tiết quán ăn
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id, 10);
    const restaurant = db.restaurants.find(r => r.id === id);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin quán ăn.' });
    }

    recalculateRestaurantRating(id);

    const reviews = db.reviews.filter(r => r.restaurantId === id && r.status === 'approved')
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    const related = db.restaurants
      .filter(r => r.category === restaurant.category && r.id !== id)
      .slice(0, 3);

    let isFavorite = false;
    if (req.user) {
      isFavorite = db.favorites.some(f => f.userId === req.user.id && f.restaurantId === id);
    }

    res.json({
      success: true,
      data: {
        ...restaurant,
        isFavorite,
        reviews,
        related
      }
    });
  } catch (error) {
    console.error('Lỗi chi tiết quán ăn:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi tải chi tiết quán ăn.' });
  }
});

// 3. Thêm quán ăn mới (Admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      name,
      category,
      address,
      area,
      price,
      image,
      gallery,
      description,
      openingHours,
      phone,
      menu,
      featured
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên quán ăn không được để trống.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn danh mục quán ăn.' });
    }
    if (!address || !address.trim()) {
      return res.status(400).json({ success: false, message: 'Địa chỉ quán ăn không được để trống.' });
    }

    const db = getDb();
    const newId = db.restaurants.length > 0 ? Math.max(...db.restaurants.map(r => r.id)) + 1 : 1;

    const newRestaurant = {
      id: newId,
      name: name.trim(),
      category: category.trim(),
      address: address.trim(),
      area: area ? area.trim() : (address.includes('Hà Nội') ? 'Hà Nội' : 'TP. Hồ Chí Minh'),
      price: price ? price.trim() : '30.000đ - 80.000đ',
      minPrice: parsePrice(price) || 30000,
      maxPrice: parsePrice(price) * 2 || 80000,
      image: image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
      gallery: Array.isArray(gallery) ? gallery : [],
      description: description ? description.trim() : '',
      openingHours: openingHours ? openingHours.trim() : '07:00 - 22:00',
      phone: phone ? phone.trim() : '',
      rating: 5.0,
      reviewsCount: 0,
      menu: Array.isArray(menu) ? menu : [],
      featured: Boolean(featured),
      createdAt: new Date().toISOString()
    };

    db.restaurants.unshift(newRestaurant);
    saveDb();

    res.status(201).json({
      success: true,
      message: 'Thêm quán ăn mới thành công!',
      data: newRestaurant
    });
  } catch (error) {
    console.error('Lỗi thêm quán ăn:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi thêm quán ăn.' });
  }
});

// 4. Sửa quán ăn (Admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const index = db.restaurants.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy quán ăn để chỉnh sửa.' });
    }

    const existing = db.restaurants[index];
    const {
      name,
      category,
      address,
      area,
      price,
      image,
      gallery,
      description,
      openingHours,
      phone,
      menu,
      featured
    } = req.body;

    if (name) existing.name = name.trim();
    if (category) existing.category = category.trim();
    if (address) existing.address = address.trim();
    if (area !== undefined) existing.area = area.trim();
    if (price !== undefined) {
      existing.price = price.trim();
      existing.minPrice = parsePrice(price) || existing.minPrice;
      existing.maxPrice = parsePrice(price) * 2 || existing.maxPrice;
    }
    if (image !== undefined) existing.image = image.trim();
    if (gallery !== undefined) existing.gallery = gallery;
    if (description !== undefined) existing.description = description.trim();
    if (openingHours !== undefined) existing.openingHours = openingHours.trim();
    if (phone !== undefined) existing.phone = phone.trim();
    if (menu !== undefined) existing.menu = menu;
    if (featured !== undefined) existing.featured = Boolean(featured);

    saveDb();

    res.json({
      success: true,
      message: 'Cập nhật thông tin quán ăn thành công!',
      data: existing
    });
  } catch (error) {
    console.error('Lỗi sửa quán ăn:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật quán ăn.' });
  }
});

// 5. Xóa quán ăn (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const index = db.restaurants.findIndex(r => r.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy quán ăn để xóa.' });
    }

    db.restaurants.splice(index, 1);
    db.reviews = db.reviews.filter(r => r.restaurantId !== id);
    db.favorites = db.favorites.filter(f => f.restaurantId !== id);

    saveDb();

    res.json({
      success: true,
      message: 'Đã xóa quán ăn và dữ liệu liên quan thành công!'
    });
  } catch (error) {
    console.error('Lỗi xóa quán ăn:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xóa quán ăn.' });
  }
});

export default router;

