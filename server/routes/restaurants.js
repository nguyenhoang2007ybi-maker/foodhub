import express from 'express';
import { getDb, saveDb, recalculateRestaurantRating } from '../db.js';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const match = priceStr.replace(/\./g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value.trim());
}

// Đọc & chuẩn hóa giờ mở/đóng cửa từ body request.
// Trả về null nếu request không gửi trường giờ nào (giữ nguyên dữ liệu hiện tại),
// trả về { error } nếu Admin gửi giá trị giờ không hợp lệ.
function resolveHours(body = {}) {
  const hasTimeFields = body.openingTime !== undefined || body.closingTime !== undefined || body.open24 !== undefined;
  if (!hasTimeFields) return null;

  if (body.openingTime !== undefined && body.openingTime !== null && body.openingTime !== '' && !isValidTime(body.openingTime)) {
    return { error: 'Giờ mở cửa không hợp lệ. Vui lòng chọn mốc giờ cách nhau 30 phút (ví dụ 08:00).' };
  }
  if (body.closingTime !== undefined && body.closingTime !== null && body.closingTime !== '' && !isValidTime(body.closingTime)) {
    return { error: 'Giờ đóng cửa không hợp lệ. Vui lòng chọn mốc giờ cách nhau 30 phút (ví dụ 22:00).' };
  }

  const open24 = body.open24 === true;
  let openingTime = isValidTime(body.openingTime) ? body.openingTime.trim() : (open24 ? '00:00' : '07:00');
  let closingTime = isValidTime(body.closingTime) ? body.closingTime.trim() : null;

  if (open24) {
    closingTime = null;
  } else if (!closingTime) {
    return { error: 'Vui lòng chọn giờ đóng cửa hoặc chọn trạng thái mở cửa 24/24.' };
  }

  return {
    openingTime,
    closingTime,
    open24,
    openingHours: open24 ? 'Mở cửa 24/24' : `${openingTime} - ${closingTime}`
  };
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
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

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
      featured,
      mapUrl
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

    const hours = resolveHours(req.body);
    if (hours && hours.error) {
      return res.status(400).json({ success: false, message: hours.error });
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
      openingTime: hours ? hours.openingTime : '07:00',
      closingTime: hours ? hours.closingTime : '22:00',
      open24: hours ? hours.open24 : false,
      openingHours: hours ? hours.openingHours : (openingHours ? openingHours.trim() : '07:00 - 22:00'),
      phone: phone ? phone.trim() : '',
      rating: 5.0,
      reviewsCount: 0,
      menu: Array.isArray(menu) ? menu : [],
      featured: Boolean(featured),
      mapUrl: mapUrl ? String(mapUrl).trim() : '',
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
      featured,
      mapUrl
    } = req.body;

    const hours = resolveHours(req.body);
    if (hours && hours.error) {
      return res.status(400).json({ success: false, message: hours.error });
    }

    if (name) existing.name = name.trim();
    if (category) existing.category = category.trim();
    if (address) existing.address = address.trim();
    if (area !== undefined && area !== null) existing.area = String(area).trim();
    if (price !== undefined && price !== null) {
      existing.price = String(price).trim();
      existing.minPrice = parsePrice(price) || existing.minPrice;
      existing.maxPrice = parsePrice(price) * 2 || existing.maxPrice;
    }
    if (image !== undefined && image !== null) existing.image = String(image).trim();
    if (gallery !== undefined) existing.gallery = gallery;
    if (description !== undefined && description !== null) existing.description = String(description).trim();
    if (openingHours !== undefined && openingHours !== null) existing.openingHours = String(openingHours).trim();
    if (phone !== undefined && phone !== null) existing.phone = String(phone).trim();
    if (menu !== undefined) existing.menu = menu;
    if (featured !== undefined) existing.featured = Boolean(featured);
    if (mapUrl !== undefined) existing.mapUrl = String(mapUrl || '').trim();

    // Cập nhật giờ mở/đóng cửa theo dữ liệu mới (chỉ khi client có gửi lên)
    if (hours) {
      existing.openingTime = hours.openingTime;
      existing.closingTime = hours.closingTime;
      existing.open24 = hours.open24;
      existing.openingHours = hours.openingHours;
    }

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

