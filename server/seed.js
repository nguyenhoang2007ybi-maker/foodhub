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
      const baseMenu = (ORIGINAL_BASE_MENUS && ORIGINAL_BASE_MENUS[rest.id]) || [];
      const extraDishes = (EXISTING_RESTAURANTS_EXTRA_MENU && EXISTING_RESTAURANTS_EXTRA_MENU[rest.id]) || [];

      const fullMenu = [];
      const seenNames = new Set();

      [...baseMenu, ...extraDishes].forEach(d => {
        const key = d.name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          fullMenu.push({
            ...d,
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
        menu: newRest.menu.map(m => ({
          ...m,
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
