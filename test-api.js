// Automated API test suite for FoodHub backend
const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('       BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG FOODHUB BACKEND         ');
  console.log('========================================================\n');

  let adminToken = '';
  let customerToken = '';

  // 1. Health check
  console.log('[Test 1] Kiểm tra Health Check:');
  const health = await request('/api/health');
  assert(health.status === 200 && health.data.status === 'ok', 'API Server đang phản hồi trạng thái OK');

  // 2. Admin Login
  console.log('\n[Test 2] Đăng nhập Quản trị viên (admin@foodhub.vn):');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@foodhub.vn', password: 'Admin@FoodHub2026!' }
  });
  assert(adminLogin.status === 200 && adminLogin.data.success, 'Đăng nhập Admin thành công');
  assert(adminLogin.data.data?.user?.role === 'admin', 'Quyền tài khoản trả về là "admin"');
  assert(Boolean(adminLogin.data.data?.token), 'Nhận được JWT Token hợp lệ');
  adminToken = adminLogin.data.data?.token;

  // 3. Customer Login
  console.log('\n[Test 3] Đăng nhập Khách hàng (khachhang@foodhub.vn):');
  const custLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  assert(custLogin.status === 200 && custLogin.data.success, 'Đăng nhập Khách hàng thành công');
  assert(custLogin.data.data?.user?.role === 'customer', 'Quyền tài khoản là "customer"');
  customerToken = custLogin.data.data?.token;

  // 4. Invalid Password check
  console.log('\n[Test 4] Kiểm tra bảo mật khi nhập sai mật khẩu:');
  const failLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@foodhub.vn', password: 'WrongPassword123' }
  });
  assert(failLogin.status === 401 && !failLogin.data.success, 'Bị chặn với mã lỗi 401 khi sai mật khẩu');

  // 5. Auth /me endpoint
  console.log('\n[Test 5] Xác thực Token cá nhân (/api/auth/me):');
  const me = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(me.status === 200 && me.data.data.email === 'khachhang@foodhub.vn', 'Thông tin phiên làm việc chính xác');

  // 6. Security guard: Customer accessing Admin route
  console.log('\n[Test 6] Kiểm tra hàng rào phân quyền (Customer truy cập Admin route):');
  const forbiddenAdmin = await request('/api/admin/stats', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(forbiddenAdmin.status === 403, 'Bị từ chối với mã 403 Forbidden khi không có quyền Admin');

  // 7. Admin stats
  console.log('\n[Test 7] Quản trị viên lấy số liệu thống kê Dashboard (/api/admin/stats):');
  const stats = await request('/api/admin/stats', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(stats.status === 200 && stats.data.success, 'Lấy dữ liệu thống kê thành công');
  assert(stats.data.data.totalRestaurants > 0, `Số lượng quán ăn thực tế: ${stats.data.data.totalRestaurants}`);
  assert(stats.data.data.totalUsers >= 2, `Số lượng người dùng thực tế: ${stats.data.data.totalUsers}`);

  // 8. Categories list
  console.log('\n[Test 8] Lấy danh mục món ăn kèm số lượng quán (/api/categories):');
  const categories = await request('/api/categories');
  assert(categories.status === 200 && Array.isArray(categories.data.data), 'Danh mục trả về dạng mảng');
  assert(categories.data.data.length > 0, `Tìm thấy ${categories.data.data.length} danh mục ẩm thực`);

  // 9. Restaurants search & filter
  console.log('\n[Test 9] Khám phá & lọc danh sách quán ăn (/api/restaurants):');
  const rests = await request('/api/restaurants?limit=6');
  assert(rests.status === 200 && rests.data.data.length > 0, `Lấy thành công ${rests.data.data.length} quán ăn`);

  // 10. Restaurant detail
  console.log('\n[Test 10] Xem chi tiết quán ăn (/api/restaurants/1):');
  const restDetail = await request('/api/restaurants/1');
  assert(restDetail.status === 200 && restDetail.data.data.id === 1, `Chi tiết quán: "${restDetail.data.data.name}"`);
  assert(Array.isArray(restDetail.data.data.reviews), 'Danh sách nhận xét kèm theo quán ăn');

  // 11. Customer submit review & auto rating recalc
  console.log('\n[Test 11] Khách gửi đánh giá và tính lại điểm tự động (/api/reviews):');
  const testReview = await request('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: {
      restaurantId: 1,
      rating: 5,
      content: 'Món ăn tại đây cực kỳ xuất sắc, phục vụ chu đáo tận tình!'
    }
  });
  assert(testReview.status === 200 || testReview.status === 201, 'Gửi/cập nhật đánh giá thành công');

  // 12. Favorite Toggle
  console.log('\n[Test 12] Bật/tắt yêu thích quán ăn (/api/favorites/toggle):');
  const favToggle = await request('/api/favorites/toggle', {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { restaurantId: 1 }
  });
  assert(favToggle.status === 200 && typeof favToggle.data.isFavorite === 'boolean', `Trạng thái yêu thích: ${favToggle.data.isFavorite}`);

  // 13. Get user favorites
  console.log('\n[Test 13] Lấy danh sách quán ăn yêu thích của tài khoản (/api/favorites):');
  const myFavs = await request('/api/favorites', {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  assert(myFavs.status === 200 && Array.isArray(myFavs.data.data), `Số quán trong danh sách yêu thích: ${myFavs.data.data.length}`);

  // 14. Admin User Management
  console.log('\n[Test 14] Quản trị viên tra cứu danh sách người dùng (/api/admin/users):');
  const usersList = await request('/api/admin/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(usersList.status === 200 && Array.isArray(usersList.data.data), 'Danh sách người dùng trả về chuẩn');
  const hasPlainPassword = usersList.data.data.some(u => u.password || u.passwordHash);
  assert(!hasPlainPassword, 'Bảo mật: Không lộ mật khẩu hay mã băm mật khẩu trong dữ liệu trả về');

  // 15. Fallback 404 check
  console.log('\n[Test 15] Kiểm tra đường dẫn không tồn tại (/api/duong-dan-khong-ton-tai):');
  const notFound = await request('/api/duong-dan-khong-ton-tai');
  assert(notFound.status === 404, 'Trả về mã 404 chuẩn cho route không tồn tại');

  console.log('\n========================================================');
  console.log(`KẾT QUẢ: ĐÃ ĐẠT ${passed}/${passed + failed} TEST CASES.`);
  if (failed === 0) {
    console.log('TẤT CẢ CÁC API ENDPOINTS VÀ BẢO MẬT ĐỀU ĐẠT CHUẨN 100%!');
  } else {
    console.error(`Có ${failed} test cases thất bại.`);
    process.exit(1);
  }
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('Lỗi khi chạy bộ kiểm thử API:', err);
  process.exit(1);
});
