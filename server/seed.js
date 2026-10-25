import bcrypt from 'bcryptjs';
import { getDb, saveDb } from './db.js';
import { MASTER_CATEGORIES, ORIGINAL_BASE_MENUS, EXISTING_RESTAURANTS_EXTRA_MENU, NEW_RESTAURANTS } from './seedData.js';

async function seed() {
  console.log('--- KHỞI TẠO VÀ NÂNG CẤP DỮ LIỆU FOODHUB (SAFE & IDEMPOTENT) ---');
  const db = getDb();

  // 1. Đảm bảo tài khoản Quản trị viên
  let admin = db.users.find(u => u.email === 'admin@foodhub.vn');
  if (!admin) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Admin@FoodHub2026!', salt);
    const newAdmin = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      name: 'Quản trị viên FoodHub',
      email: 'admin@foodhub.vn',
      phone: '0988889999',
      passwordHash: hash,
      role: 'admin',
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      createdAt: new Date().toISOString()
    };
    db.users.push(newAdmin);
    console.log('✓ Đã tạo tài khoản Quản trị viên: admin@foodhub.vn');
  } else {
    console.log('✓ Tài khoản Quản trị viên đã tồn tại.');
  }

  // 2. Đảm bảo tài khoản Khách hàng
  let customer = db.users.find(u => u.email === 'khachhang@foodhub.vn');
  if (!customer) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Khach@FoodHub2026!', salt);
    const newCustomer = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 2,
      name: 'Nguyễn Văn A',
      email: 'khachhang@foodhub.vn',
      phone: '0912345678',
      passwordHash: hash,
      role: 'customer',
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      createdAt: new Date().toISOString()
    };
    db.users.push(newCustomer);
    console.log('✓ Đã tạo tài khoản Khách hàng mẫu: khachhang@foodhub.vn');
  } else {
    console.log('✓ Tài khoản Khách hàng mẫu đã tồn tại.');
  }

  // 3. Đảm bảo đầy đủ các danh mục ẩm thực phong phú
  let addedCatCount = 0;
  MASTER_CATEGORIES.forEach(masterCat => {
    const exists = db.categories.some(c => (c.name || c).toLowerCase() === masterCat.name.toLowerCase());
    if (!exists) {
      const nextId = db.categories.length > 0 ? Math.max(...db.categories.map(c => c.id || 0)) + 1 : 1;
      db.categories.push({
        ...masterCat,
        id: nextId
      });
      addedCatCount++;
    }
  });
  console.log(`✓ Đã đồng bộ danh mục: hiện có ${db.categories.length} danh mục ẩm thực (bổ sung mới: ${addedCatCount}).`);

  // 4. Đồng bộ & mở rộng thực đơn cho các quán ăn hiện có (nâng lên 10-12 món/quán)
  let enrichedMenuCount = 0;
  db.restaurants.forEach(rest => {
    if (rest.id <= 8) {
      const baseMenu = (Array.isArray(rest.menu) && rest.menu.length > 0) ? rest.menu : ((ORIGINAL_BASE_MENUS && ORIGINAL_BASE_MENUS[rest.id]) || []);
      const extraDishes = (EXISTING_RESTAURANTS_EXTRA_MENU && EXISTING_RESTAURANTS_EXTRA_MENU[rest.id]) || [];

      const fullMenu = [];
      const seenNames = new Set();

      [...baseMenu, ...extraDishes].forEach(d => {
        const key = d.name.toLowerCase().trim();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          const nextDishId = (rest.id * 100) + (fullMenu.length + 1);
          const priceNum = (typeof d.priceNum === 'number' && d.priceNum > 0)
            ? d.priceNum
            : (parseInt(String(d.price || '').replace(/[^\d]/g, ''), 10) || 35000);

          fullMenu.push({
            ...d,
            id: nextDishId,
            price: d.price || `${priceNum.toLocaleString('vi-VN')} đ`,
            priceNum,
            isAvailable: d.isAvailable !== false,
            restaurantId: rest.id,
            restaurantName: rest.name
          });
        }
      });

      rest.menu = fullMenu;
      enrichedMenuCount += fullMenu.length;
    }
  });
  console.log(`✓ Đã chuẩn hóa và mở rộng thực đơn cho các quán ăn hiện có (${enrichedMenuCount} món).`);

  // 5. Thêm các quán ăn mới (Tổng cộng >= 30 quán)
  let addedRestCount = 0;
  let addedDishesCount = 0;
  NEW_RESTAURANTS.forEach(newRest => {
    const restExists = db.restaurants.some(r => r.id === newRest.id || r.name.toLowerCase() === newRest.name.toLowerCase());
    if (!restExists) {
      const restaurantToAdd = {
        ...newRest,
        menu: newRest.menu.map((m, idx) => ({
          ...m,
          id: m.id || ((newRest.id * 100) + (idx + 1)),
          priceNum: (typeof m.priceNum === 'number' && m.priceNum > 0)
            ? m.priceNum
            : (parseInt(String(m.price || '').replace(/[^\d]/g, ''), 10) || 35000),
          isAvailable: m.isAvailable !== false,
          restaurantId: newRest.id,
          restaurantName: newRest.name
        }))
      };
      db.restaurants.push(restaurantToAdd);
      addedRestCount++;
      addedDishesCount += restaurantToAdd.menu.length;
    }
  });
  console.log(`✓ Đã thêm ${addedRestCount} quán ăn mới với ${addedDishesCount} món ăn phong phú.`);

  // 5.1. Rà soát và đảm bảo 100% món ăn trong tất cả các quán đều có ID và priceNum hợp lệ
  let totalDishesNormalized = 0;
  db.restaurants.forEach(rest => {
    if (Array.isArray(rest.menu)) {
      rest.menu = rest.menu.map((dish, idx) => {
        const dishId = (typeof dish.id === 'number' && dish.id > 0) ? dish.id : ((rest.id * 100) + (idx + 1));
        const priceNum = (typeof dish.priceNum === 'number' && dish.priceNum > 0)
          ? dish.priceNum
          : (parseInt(String(dish.price || '').replace(/[^\d]/g, ''), 10) || 35000);
        totalDishesNormalized++;
        return {
          ...dish,
          id: dishId,
          price: dish.price || `${priceNum.toLocaleString('vi-VN')} đ`,
          priceNum,
          isAvailable: dish.isAvailable !== false,
          restaurantId: rest.id,
          restaurantName: rest.name
        };
      });
    }
  });
  console.log(`✓ Đã kiểm tra và chuẩn hóa toàn bộ ${totalDishesNormalized} món ăn trong hệ thống.`);

  // 6. Đảm bảo các mã giảm giá mặc định (Coupons)
  if (!Array.isArray(db.coupons)) db.coupons = [];
  const DEFAULT_COUPONS = [
    {
      id: 1,
      code: 'FOODHUB10',
      type: 'percent',
      value: 10,
      maxDiscount: 50000,
      minOrder: 50000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      totalLimit: 1000,
      perUserLimit: 5,
      scope: 'all',
      description: 'Giảm 10% tối đa 50.000 đ cho đơn từ 50.000 đ',
      isActive: true,
      usedCount: 0,
      usedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      code: 'FREESHIP',
      type: 'freeship',
      value: 15000,
      maxDiscount: 15000,
      minOrder: 100000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      totalLimit: 500,
      perUserLimit: 3,
      scope: 'all',
      description: 'Miễn phí vận chuyển (tối đa 15.000 đ) cho đơn từ 100.000 đ',
      isActive: true,
      usedCount: 0,
      usedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      code: 'BANMOI',
      type: 'fixed',
      value: 20000,
      maxDiscount: 20000,
      minOrder: 80000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      totalLimit: 200,
      perUserLimit: 1,
      scope: 'all',
      description: 'Giảm ngay 20.000 đ cho khách hàng mới với đơn từ 80.000 đ',
      isActive: true,
      usedCount: 0,
      usedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 4,
      code: 'GIAM50K',
      type: 'fixed',
      value: 50000,
      maxDiscount: 50000,
      minOrder: 200000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      totalLimit: 300,
      perUserLimit: 2,
      scope: 'all',
      description: 'Giảm ngay 50.000 đ cho đơn tiệc đông người từ 200.000 đ',
      isActive: true,
      usedCount: 0,
      usedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  DEFAULT_COUPONS.forEach(coupon => {
    const exists = db.coupons.some(c => c.code === coupon.code);
    if (!exists) {
      db.coupons.push(coupon);
    }
  });
  console.log(`✓ Đã đồng bộ mã giảm giá: hiện có ${db.coupons.length} mã ưu đãi.`);

  // 7. Chuẩn hóa toàn bộ đánh giá: Chuyển tất cả pending sang approved (Công khai)
  if (Array.isArray(db.reviews)) {
    let approvedCount = 0;
    db.reviews.forEach(r => {
      if (r.status === 'pending' || !r.status || r.status === 'hidden') {
        r.status = 'approved';
        approvedCount++;
      }
    });
    console.log(`✓ Đã chuẩn hóa đánh giá: Chuyển ${approvedCount} đánh giá sang trạng thái 'approved' (Công khai tức thì).`);
  }

  // 8. Tự động tính lại rating và reviewsCount cho tất cả các quán ăn
  db.restaurants.forEach(rest => {
    const validReviews = (db.reviews || []).filter(r => r.restaurantId === rest.id && r.status !== 'hidden' && r.status !== 'rejected');
    if (validReviews.length === 0) {
      rest.reviewsCount = rest.reviewsCount || 0;
    } else {
      const sum = validReviews.reduce((acc, curr) => acc + Number(curr.rating || 5), 0);
      rest.rating = Number((sum / validReviews.length).toFixed(1));
      rest.reviewsCount = validReviews.length;
    }
  });
  console.log(`✓ Đã tính toán lại điểm số và số lượng nhận xét cho toàn bộ ${db.restaurants.length} quán ăn.`);

  // Tổng kết số lượng
  const totalDishes = db.restaurants.reduce((sum, r) => sum + (Array.isArray(r.menu) ? r.menu.length : 0), 0);
  console.log(`=======================================================`);
  console.log(`TỔNG KẾT HỆ THỐNG SAU KHI SEED:`);
  console.log(`- Tổng số quán ăn: ${db.restaurants.length} quán (Yêu cầu: >= 30 quán)`);
  console.log(`- Tổng số món ăn: ${totalDishes} món (Trung bình: ${(totalDishes / db.restaurants.length).toFixed(1)} món/quán)`);
  console.log(`- Tổng số danh mục: ${db.categories.length} danh mục`);
  console.log(`- Tổng số người dùng: ${db.users.length} tài khoản`);
  console.log(`=======================================================`);

  saveDb();
  console.log('--- KHỞI TẠO HOÀN TẤT THÀNH CÔNG ---');
}

seed().catch(err => {
  console.error('Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
