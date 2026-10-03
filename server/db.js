import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'foodhub.json');
const LEGACY_DB = path.join(__dirname, '../db.json');

// Đảm bảo thư mục data tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Cấu trúc mặc định
const initialSchema = {
  users: [],
  restaurants: [],
  categories: [],
  reviews: [],
  favorites: [],
  settings: {
    siteName: 'FoodHub',
    slogan: 'Khám phá quán ăn ngon quanh bạn',
    hotline: '1900 8888',
    email: 'contact@foodhub.vn',
    address: 'Hà Nội & TP. Hồ Chí Minh',
    description: 'FoodHub là nền tảng tìm kiếm, khám phá và chia sẻ trải nghiệm ăn uống chân thực nhất.',
    logoUrl: '/favicon.svg'
  }
};

let dbCache = null;

export function getDb() {
  if (dbCache) return dbCache;

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      return dbCache;
    } catch (err) {
      console.error('Lỗi đọc database file, sử dụng schema mặc định:', err);
    }
  }

  // Nếu file chưa có, kiểm tra file legacy db.json để migrate dữ liệu cũ
  dbCache = { ...initialSchema };
  if (fs.existsSync(LEGACY_DB)) {
    try {
      const legacyData = JSON.parse(fs.readFileSync(LEGACY_DB, 'utf-8'));
      if (Array.isArray(legacyData.restaurants)) {
        dbCache.restaurants = legacyData.restaurants.map((r, i) => ({
          id: r.id || i + 1,
          name: r.name,
          category: r.category || 'Món Việt',
          address: r.address || 'Hà Nội',
          area: r.address ? (r.address.includes('Lò Đúc') ? 'Hai Bà Trưng' : 'Hoàn Kiếm') : 'Hà Nội',
          price: r.price || '50.000đ - 100.000đ',
          minPrice: 50000,
          maxPrice: 100000,
          image: r.image || '',
          gallery: [],
          description: r.description || '',
          openingHours: '06:00 - 22:00',
          phone: '0901234567',
          rating: r.rating || 4.5,
          reviewsCount: 1,
          menu: [],
          featured: true,
          createdAt: new Date().toISOString()
        }));
      }
      if (Array.isArray(legacyData.reviews)) {
        dbCache.reviews = legacyData.reviews.map((rev, i) => ({
          id: rev.id || i + 1,
          restaurantId: rev.restaurantId || 1,
          userId: 2,
          userName: rev.name || 'Người dùng',
          userAvatar: '',
          rating: rev.rating || 5,
          content: rev.content || 'Quán ăn tuyệt vời',
          images: [],
          status: 'approved',
          date: rev.date || new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString()
        }));
      }
    } catch (e) {
      console.error('Không thể migrate legacy db.json:', e);
    }
  }

  saveDb();
  return dbCache;
}

export function saveDb() {
  if (!dbCache) return;
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Lỗi ghi database file:', err);
  }
}

// Helper tự động tính lại điểm trung bình và số lượng review của quán ăn
export function recalculateRestaurantRating(restaurantId) {
  const db = getDb();
  const restId = Number(restaurantId);
  const restaurant = db.restaurants.find(r => r.id === restId);
  if (!restaurant) return;

  const validReviews = db.reviews.filter(r => r.restaurantId === restId && r.status === 'approved');
  if (validReviews.length === 0) {
    restaurant.reviewsCount = 0;
  } else {
    const sum = validReviews.reduce((acc, curr) => acc + Number(curr.rating || 5), 0);
    restaurant.rating = Number((sum / validReviews.length).toFixed(1));
    restaurant.reviewsCount = validReviews.length;
  }
  saveDb();
}
