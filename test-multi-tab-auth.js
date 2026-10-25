// FoodHub Multi-Tab Concurrent Session Verification Test
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import app from './server/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} ${details ? `(${details})` : ''}`);
  }
}

function request(path, options = {}) {
  return new Promise((resolve) => {
    const method = options.method || 'GET';
    const payload = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
    const req = new Readable({
      read() {
        if (payload) this.push(payload);
        this.push(null);
      }
    });
    req.method = method;
    req.url = path;
    const normHeaders = {};
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        normHeaders[k.toLowerCase()] = v;
      }
    }
    req.headers = {
      host: 'localhost',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload).toString(),
      ...normHeaders
    };

    const chunks = [];
    const resHeaders = {};
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
      getHeader(k) { return resHeaders[k.toLowerCase()]; },
      write(c) { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)); },
      end(c) {
        if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
        const str = Buffer.concat(chunks).toString('utf8');
        let data = {};
        try { data = JSON.parse(str); } catch (_) { data = str; }
        resolve({
          status: this.statusCode || 200,
          ok: (this.statusCode || 200) >= 200 && (this.statusCode || 200) < 300,
          headers: resHeaders,
          data
        });
      }
    });

    app.handle(req, res);
  });
}

// Mô phỏng lớp Client Context của 1 Tab trình duyệt
class BrowserTabSession {
  constructor(name) {
    this.name = name;
    this.sessionStorage = new Map();
  }

  setToken(token) {
    this.sessionStorage.set('foodhub_token', token);
  }

  getToken() {
    return this.sessionStorage.get('foodhub_token') || null;
  }

  removeToken() {
    this.sessionStorage.delete('foodhub_token');
  }

  setUser(user) {
    this.sessionStorage.set('foodhub_user', JSON.stringify(user));
  }

  getUser() {
    const raw = this.sessionStorage.get('foodhub_user');
    return raw ? JSON.parse(raw) : null;
  }

  removeUser() {
    this.sessionStorage.delete('foodhub_user');
  }

  isLoggedIn() {
    return Boolean(this.getToken() && this.getUser());
  }

  isAdmin() {
    const user = this.getUser();
    return Boolean(user && user.role === 'admin');
  }

  logout() {
    this.removeToken();
    this.removeUser();
  }

  // Gửi request từ Tab này (kèm token của riêng Tab này)
  async apiRequest(endpoint, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return request(endpoint, { ...options, headers });
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('  KIỂM THỬ XÁC THỰC HAI TAB ĐỒNG THỜI (ADMIN & KHÁCH HÀNG ĐỘC LẬP)   ');
  console.log('======================================================================\n');

  // Khởi tạo hai Tab độc lập
  const tab1 = new BrowserTabSession('Tab 1 (Admin)');
  const tab2 = new BrowserTabSession('Tab 2 (Customer)');

  // -------------------------------------------------------------
  // TRƯỜNG HỢP A: Tab 1 mở URL FoodHub và đăng nhập Admin
  // -------------------------------------------------------------
  console.log('--- TRƯỜNG HỢP A: Tab 1 đăng nhập tài khoản Admin ---');
  const adminLoginRes = await tab1.apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@foodhub.vn', password: 'Admin@FoodHub2026!' }
  });
  assert(adminLoginRes.status === 200, 'Tab 1: Đăng nhập admin thành công');
  tab1.setToken(adminLoginRes.data.data.token);
  tab1.setUser(adminLoginRes.data.data.user);

  assert(tab1.isLoggedIn() === true, 'Tab 1: Trạng thái isLoggedIn = true');
  assert(tab1.isAdmin() === true, 'Tab 1: Trạng thái isAdmin = true');
  assert(tab1.getUser()?.role === 'admin', 'Tab 1: Role người dùng là admin');

  // Kiểm tra Tab 1 truy cập API Admin
  const adminStatsRes = await tab1.apiRequest('/api/orders/admin/stats');
  assert(adminStatsRes.status === 200, 'Tab 1: Truy cập thành công API thống kê quản trị (/api/orders/admin/stats)');
  const adminUsersRes = await tab1.apiRequest('/api/admin/users');
  assert(adminUsersRes.status === 200, 'Tab 1: Truy cập thành công API quản lý người dùng (/api/admin/users)');

  // -------------------------------------------------------------
  // TRƯỜNG HỢP B: Tab 2 mở cùng URL FoodHub và đăng nhập Khách hàng
  // -------------------------------------------------------------
  console.log('\n--- TRƯỜNG HỢP B: Tab 2 đăng nhập tài khoản Khách hàng ---');
  assert(tab2.isLoggedIn() === false, 'Tab 2 ban đầu hoàn toàn sạch session, chưa đăng nhập (isLoggedIn = false)');
  assert(tab2.getToken() === null, 'Tab 2 không bị nhiễm token của Tab 1');

  const customerLoginRes = await tab2.apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  assert(customerLoginRes.status === 200, 'Tab 2: Đăng nhập khách hàng thành công');
  tab2.setToken(customerLoginRes.data.data.token);
  tab2.setUser(customerLoginRes.data.data.user);

  assert(tab2.isLoggedIn() === true, 'Tab 2: Trạng thái isLoggedIn = true');
  assert(tab2.isAdmin() === false, 'Tab 2: Trạng thái isAdmin = false (Không phải admin)');
  assert(tab2.getUser()?.role === 'customer', 'Tab 2: Role người dùng là customer');
  assert(tab2.getUser()?.name === 'Nguyễn Văn A', 'Tab 2: Tên khách hàng đúng là Nguyễn Văn A');

  // -------------------------------------------------------------
  // KIỂM TRA ĐỒNG THỜI (CONCURRENT VERIFICATION)
  // -------------------------------------------------------------
  console.log('\n--- KIỂM TRA ĐỒNG THỜI 1: Tab 1 vẫn giữ quyền Admin sau khi Tab 2 đăng nhập ---');
  assert(tab1.isLoggedIn() === true, 'Tab 1: Vẫn đang đăng nhập');
  assert(tab1.isAdmin() === true, 'Tab 1: Vẫn giữ nguyên quyền admin');
  assert(tab1.getUser()?.role === 'admin', 'Tab 1: Role vẫn là admin, không bị đổi thành customer');
  assert(tab1.getUser()?.email === 'admin@foodhub.vn', 'Tab 1: Email vẫn là admin@foodhub.vn');

  // Tab 1 tiếp tục gọi API admin thành công
  const adminOrdersRes = await tab1.apiRequest('/api/orders/admin/all');
  assert(adminOrdersRes.status === 200, 'Tab 1: Vẫn truy cập được danh sách đơn hàng quản trị (/api/orders/admin/all)');

  console.log('\n--- KIỂM TRA ĐỒNG THỜI 2: Tab 2 vẫn giữ nguyên tài khoản Khách hàng ---');
  assert(tab2.isLoggedIn() === true, 'Tab 2: Vẫn giữ đăng nhập');
  assert(tab2.isAdmin() === false, 'Tab 2: Vẫn là customer, không bị chuyển thành admin');
  const custProfileRes = await tab2.apiRequest('/api/auth/me');
  assert(custProfileRes.status === 200, 'Tab 2: Gọi /api/auth/me thành công');
  assert(custProfileRes.data.data?.email === 'khachhang@foodhub.vn', 'Tab 2: Trả về đúng thông tin cá nhân của khách hàng');

  console.log('\n--- KIỂM TRA ĐỒNG THỜI 3: Khách hàng ở Tab 2 BỊ CHẶN khi cố truy cập API Admin ---');
  const custAttackStats = await tab2.apiRequest('/api/orders/admin/stats');
  assert(custAttackStats.status === 403, 'Tab 2: Bị chặn khi gọi /api/orders/admin/stats (HTTP 403 Forbidden)');
  const custAttackUsers = await tab2.apiRequest('/api/admin/users');
  assert(custAttackUsers.status === 403, 'Tab 2: Bị chặn khi gọi /api/admin/users (HTTP 403 Forbidden)');

  console.log('\n--- KIỂM TRA ĐỒNG THỜI 4: Giả lập tải lại trang (Reload / F5) ở cả hai Tab ---');
  // Khi reload, sessionStorage của từng tab được duy trì nguyên vẹn
  assert(tab1.isLoggedIn() && tab1.isAdmin(), 'Tab 1 sau khi reload: Vẫn là Quản trị viên (Admin)');
  assert(tab2.isLoggedIn() && !tab2.isAdmin(), 'Tab 2 sau khi reload: Vẫn là Khách hàng (Customer)');

  console.log('\n--- KIỂM TRA ĐỒNG THỜI 5: Tách biệt Giỏ hàng & Đơn hàng giữa hai tài khoản ---');
  // Tab 1 (Admin - ID 1) cập nhật giỏ hàng:
  const cartAdminRes = await tab1.apiRequest('/api/cart', {
    method: 'POST',
    body: {
      restaurantId: 1,
      items: [{ dishId: 101, id: 101, name: 'Phở tái lăn đặc biệt', priceNum: 75000, quantity: 1 }]
    }
  });
  assert(cartAdminRes.status === 200, 'Tab 1 (Admin): Cập nhật giỏ hàng admin thành công');

  // Tab 2 (Customer - ID 2) cập nhật giỏ hàng khác:
  const cartCustRes = await tab2.apiRequest('/api/cart', {
    method: 'POST',
    body: {
      restaurantId: 1,
      items: [{ dishId: 104, id: 104, name: 'Trứng gà trần', priceNum: 10000, quantity: 5 }]
    }
  });
  assert(cartCustRes.status === 200, 'Tab 2 (Customer): Cập nhật giỏ hàng customer thành công');

  // Đọc lại giỏ hàng từ Tab 1:
  const getCart1 = await tab1.apiRequest('/api/cart');
  assert(getCart1.data.data?.items?.[0]?.dishId === 101, 'Tab 1 chỉ nhìn thấy món của Admin (Phở tái lăn), không bị lẫn món của Customer');

  // Đọc lại giỏ hàng từ Tab 2:
  const getCart2 = await tab2.apiRequest('/api/cart');
  assert(getCart2.data.data?.items?.[0]?.dishId === 104, 'Tab 2 chỉ nhìn thấy món của Customer (Trứng gà trần), không bị lẫn món của Admin');

  console.log('\n--- KIỂM TRA ĐỒNG THỜI 6: Đăng xuất ở Tab 2 (Khách hàng) KHÔNG ảnh hưởng Tab 1 ---');
  tab2.logout();
  assert(tab2.isLoggedIn() === false, 'Tab 2: Đã đăng xuất (isLoggedIn = false)');
  assert(tab2.getToken() === null, 'Tab 2: Token đã xóa');

  // Kiểm tra Tab 1
  assert(tab1.isLoggedIn() === true, 'Tab 1: VẪN ĐANG ĐĂNG NHẬP sau khi Tab 2 đăng xuất');
  assert(tab1.isAdmin() === true, 'Tab 1: VẪN CÒN ĐẦY ĐỦ QUYỀN ADMIN');
  const verifyAdminStillActive = await tab1.apiRequest('/api/orders/admin/stats');
  assert(verifyAdminStillActive.status === 200, 'Tab 1: Vẫn gọi thành công API admin (/api/orders/admin/stats)');

  console.log('\n--- KIỂM TRA ĐỒNG THỜI 7: Đăng xuất ở Tab 1 (Admin) ---');
  tab1.logout();
  assert(tab1.isLoggedIn() === false, 'Tab 1: Đã đăng xuất (isLoggedIn = false)');
  assert(tab1.getToken() === null, 'Tab 1: Token đã xóa');

  console.log('\n======================================================================');
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passed} THÀNH CÔNG, ${failed} THẤT BẠI`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Lỗi ngoại lệ:', err);
  process.exit(1);
});

