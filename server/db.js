import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'foodhub.json');

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
  orders: [],
  carts: [],
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
  if (dbCache) {
    if (!Array.isArray(dbCache.orders)) dbCache.orders = [];
    if (!Array.isArray(dbCache.carts)) dbCache.carts = [];
    return dbCache;
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      if (!Array.isArray(dbCache.orders)) dbCache.orders = [];
      if (!Array.isArray(dbCache.carts)) dbCache.carts = [];
      return dbCache;
    } catch (err) {
      console.error('Lỗi đọc database file, sử dụng schema mặc định:', err);
    }
  }

  dbCache = { ...initialSchema };
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
