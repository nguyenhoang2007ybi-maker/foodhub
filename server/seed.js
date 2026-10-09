import bcrypt from 'bcryptjs';
import { getDb, saveDb } from './db.js';

async function seed() {
  console.log('--- KHỞI TẠO DỮ LIỆU FOODHUB (SAFE SEED) ---');
  const db = getDb();

  // Đảm bảo có ít nhất 1 tài khoản Admin
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

  // Đảm bảo có tài khoản Customer mẫu
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

  console.log(`✓ Thống kê hiện tại: ${db.restaurants.length} quán ăn, ${db.categories.length} danh mục, ${db.reviews.length} đánh giá, ${db.users.length} người dùng.`);
  saveDb();
  console.log('--- KHỞI TẠO HOÀN TẤT ---');
}

seed().catch(err => {
  console.error('Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
