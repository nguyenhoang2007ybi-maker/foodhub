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
  emailVerifications: {},
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

// Chuyển giá kiểu Việt Nam ("75.000đ", "10.000đ/cặp") thành số nguyên.
export function parsePriceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }
  if (value === null || value === undefined) return 0;
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

// Bổ sung id + priceNum còn thiếu cho menu và giỏ hàng.
// Dữ liệu cũ từng bị mất 2 trường này khiến nút +/- và Xóa không tìm được món.
function normalizeDb(db) {
  let changed = false;

  (db.restaurants || []).forEach(restaurant => {
    if (!Array.isArray(restaurant.menu)) {
      restaurant.menu = [];
      changed = true;
    }

    const restId = Number(restaurant.id) || 0;
    const usedIds = new Set(
      restaurant.menu
        .map(dish => Number(dish.id))
        .filter(id => Number.isFinite(id) && id > 0)
    );

    restaurant.menu.forEach((dish, index) => {
      const currentId = Number(dish.id);
      if (!Number.isFinite(currentId) || currentId <= 0) {
        let newId = restId * 1000 + index + 1;
        while (usedIds.has(newId)) newId += 1;
        dish.id = newId;
        usedIds.add(newId);
        changed = true;
      }

      const currentPriceNum = Number(dish.priceNum);
      if (!Number.isFinite(currentPriceNum) || currentPriceNum <= 0) {
        const parsed = parsePriceNumber(dish.price);
        if (parsed > 0) {
          dish.priceNum = parsed;
          changed = true;
        }
      }
    });
  });

  (db.carts || []).forEach(cart => {
    if (!Array.isArray(cart.items)) {
      cart.items = [];
      changed = true;
      return;
    }

    const restaurant = (db.restaurants || []).find(r => Number(r.id) === Number(cart.restaurantId));
    const menu = restaurant && Array.isArray(restaurant.menu) ? restaurant.menu : [];

    cart.items.forEach(item => {
      let dish = menu.find(m => Number(m.id) === Number(item.dishId));
      if (!dish && item.name) {
        dish = menu.find(m => m.name === item.name);
      }

      if (dish) {
        if (Number(item.dishId) !== Number(dish.id)) {
          item.dishId = dish.id;
          changed = true;
        }
        if (Number(item.restaurantId) !== Number(restaurant.id)) {
          item.restaurantId = restaurant.id;
          changed = true;
        }
        if (item.name !== dish.name) {
          item.name = dish.name;
          changed = true;
        }
        if (item.price !== dish.price) {
          item.price = dish.price;
          changed = true;
        }
        const priceNum = Number(dish.priceNum) || parsePriceNumber(dish.price);
        if (priceNum > 0 && Number(item.priceNum) !== priceNum) {
          item.priceNum = priceNum;
          changed = true;
        }
      }

      const quantity = parseInt(item.quantity, 10);
      if (!Number.isFinite(quantity) || quantity < 1) {
        item.quantity = 1;
        changed = true;
      } else if (quantity > 99) {
        item.quantity = 99;
        changed = true;
      }
    });
  });

  return changed;
}

export function getDb() {
  if (dbCache) {
    if (!Array.isArray(dbCache.orders)) dbCache.orders = [];
    if (!Array.isArray(dbCache.carts)) dbCache.carts = [];
    if (normalizeDb(dbCache)) saveDb();
    return dbCache;
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
      if (!Array.isArray(dbCache.orders)) dbCache.orders = [];
      if (!Array.isArray(dbCache.carts)) dbCache.carts = [];
      if (normalizeDb(dbCache)) saveDb();
      return dbCache;
    } catch (err) {
      console.error('Lỗi đọc database file, sử dụng schema mặc định:', err);
    }
  }

  dbCache = { ...initialSchema };
  normalizeDb(dbCache);
  saveDb();
  return dbCache;
}

export function saveDb() {
  if (!dbCache) return false;
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
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
