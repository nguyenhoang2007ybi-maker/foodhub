import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = process.env.FOODHUB_DB_FILE
  ? path.resolve(process.env.FOODHUB_DB_FILE)
  : path.join(DATA_DIR, 'foodhub.json');

// Đảm bảo thư mục chứa file dữ liệu tồn tại
const DB_DIR = path.dirname(DB_FILE);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
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
  coupons: [],
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

function normalizeDbSchema(db) {
  if (!db) return false;
  if (!Array.isArray(db.orders)) db.orders = [];
  if (!Array.isArray(db.carts)) db.carts = [];
  if (!Array.isArray(db.coupons)) db.coupons = [];
  if (!Array.isArray(db.restaurants)) db.restaurants = [];
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.reviews)) db.reviews = [];

  let needsSave = false;

  // Chuẩn hóa toàn bộ thực đơn của tất cả các quán ăn
  db.restaurants.forEach(rest => {
    if (Array.isArray(rest.menu)) {
      rest.menu.forEach((dish, idx) => {
        const dishId = (dish.id !== undefined && !isNaN(Number(dish.id)) && Number(dish.id) > 0)
          ? Number(dish.id)
          : (rest.id * 100 + (idx + 1));
        const priceNum = (typeof dish.priceNum === 'number' && dish.priceNum > 0)
          ? dish.priceNum
          : (parseInt(String(dish.price || '').replace(/[^\d]/g, ''), 10) || 35000);

        if (dish.id !== dishId || dish.priceNum !== priceNum || dish.isAvailable === undefined) {
          dish.id = dishId;
          dish.priceNum = priceNum;
          if (dish.isAvailable === undefined) dish.isAvailable = true;
          needsSave = true;
        }
      });
    }
  });

  return needsSave;
}

export function getDb() {
  if (dbCache) {
    if (!Array.isArray(dbCache.orders)) dbCache.orders = [];
    if (!Array.isArray(dbCache.carts)) dbCache.carts = [];
    if (!Array.isArray(dbCache.coupons)) dbCache.coupons = [];
    return dbCache;
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      const needsSave = normalizeDbSchema(dbCache);
      if (needsSave) {
        saveDb();
      }
      return dbCache;
    } catch (err) {
      console.error('Lỗi đọc database file, sử dụng schema mặc định:', err);
    }
  }

  dbCache = { ...initialSchema };
  normalizeDbSchema(dbCache);
  saveDb();
  return dbCache;
}

export function saveDb() {
  if (!dbCache) return;
  const content = JSON.stringify(dbCache, null, 2);
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, content, 'utf-8');
    try {
      fs.renameSync(tempFile, DB_FILE);
    } catch (renameErr) {
      // Fallback tương thích Windows khi file bị lock (EPERM/EBUSY)
      fs.writeFileSync(DB_FILE, content, 'utf-8');
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
  } catch (err) {
    console.error('Lỗi ghi database file:', err);
    return false;
  }
}

// Helper tự động tính lại điểm trung bình và số lượng review của quán ăn
export function recalculateRestaurantRating(restaurantId) {
  const db = getDb();
  const restId = Number(restaurantId);
  const restaurant = db.restaurants.find(r => r.id === restId);
  if (!restaurant) return;

  // Lấy tất cả các đánh giá hợp lệ (không bị ẩn hoặc từ chối)
  const validReviews = db.reviews.filter(r => r.restaurantId === restId && r.status !== 'hidden' && r.status !== 'rejected');
  if (validReviews.length === 0) {
    restaurant.reviewsCount = 0;
  } else {
    const sum = validReviews.reduce((acc, curr) => acc + Number(curr.rating || 5), 0);
    restaurant.rating = Number((sum / validReviews.length).toFixed(1));
    restaurant.reviewsCount = validReviews.length;
  }
  saveDb();
}
