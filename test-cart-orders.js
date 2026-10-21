import assert from 'assert';

const BASE_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Helper xác thực email OTP
async function getEmailVerificationToken(email) {
  const otpRes = await request('/email/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  assert.strictEqual(otpRes.status, 200, 'Gửi mã OTP thành công');
  const devCode = otpRes.data.devCode;

  const verifyRes = await request('/email/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp: devCode })
  });
  assert.strictEqual(verifyRes.status, 200, 'Xác thực OTP thành công');
  return verifyRes.data.verificationToken;
}

async function runTests() {
  console.log('--- BẮT ĐẦU KIỂM THỬ HỆ THỐNG GIỎ HÀNG & ĐẶT HÀNG FOODHUB ---');

  // 1. Đăng nhập người dùng bình thường
  console.log('\n[1] Đăng nhập tài khoản khách hàng...');
  const userLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' })
  });
  assert.strictEqual(userLogin.status, 200, 'Khách hàng đăng nhập thành công');
  const userToken = userLogin.data.data.token;
  const userHeaders = { Authorization: `Bearer ${userToken}` };
  console.log('✓ Đăng nhập khách hàng thành công. Token:', userToken.slice(0, 15) + '...');

  // 2. Đăng nhập tài khoản admin
  console.log('\n[2] Đăng nhập tài khoản Admin...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@foodhub.vn', password: 'Admin@FoodHub2026!' })
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin đăng nhập thành công');
  const adminToken = adminLogin.data.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  console.log('✓ Đăng nhập Admin thành công. Token:', adminToken.slice(0, 15) + '...');

  // 3. Xóa giỏ hàng hiện tại để test sạch sẽ
  console.log('\n[3] Xóa giỏ hàng hiện tại...');
  const delCart = await request('/cart', {
    method: 'DELETE',
    headers: userHeaders
  });
  assert.strictEqual(delCart.status, 200);
  console.log('✓ Đã làm trống giỏ hàng ban đầu.');

  // 4. Lấy giỏ hàng trống
  console.log('\n[4] Lấy giỏ hàng (GET /api/cart)...');
  const getCart = await request('/cart', {
    method: 'GET',
    headers: userHeaders
  });
  assert.strictEqual(getCart.status, 200);
  assert.deepStrictEqual(getCart.data.data.items, []);
  console.log('✓ Giỏ hàng rỗng chính xác:', getCart.data.data);

  // 5. Cập nhật món vào giỏ hàng (Quán 1: Phở Thìn Lò Đúc)
  console.log('\n[5] Cập nhật giỏ hàng với món quán 1 (Phở Thìn Lò Đúc)...');
  const saveCart = await request('/cart', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      restaurantId: 1,
      restaurantName: 'Phở Thìn Lò Đúc',
      restaurantAddress: '13 Lò Đúc, Phường Phạm Đình Hổ, Hai Bà Trưng, Hà Nội',
      items: [
        { dishId: 1, name: 'Phở tái nạm', quantity: 2, priceNum: 65000, note: 'Ít hành' },
        { dishId: 2, name: 'Quẩy giòn giòn (cặp)', quantity: 3, priceNum: 10000, note: '' }
      ]
    })
  });
  assert.strictEqual(saveCart.status, 200);
  assert.strictEqual(saveCart.data.data.items.length, 2);
  console.log('✓ Lưu giỏ hàng thành công:', saveCart.data.data.items.length, 'món');

  // 6. Tạo đơn hàng với mã giảm giá FOODHUB10 sau khi xác nhận email OTP
  console.log('\n[6] Xác nhận OTP email và đặt hàng (POST /api/orders) với coupon FOODHUB10...');
  const verificationToken1 = await getEmailVerificationToken('khachhang@foodhub.vn');

  const createOrder = await request('/orders', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      restaurantId: 1,
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0912345678',
      contactEmail: 'khachhang@foodhub.vn',
      emailVerificationToken: verificationToken1,
      deliveryAddress: 'Số 12 phố Tràng Thi, Hoàn Kiếm, Hà Nội',
      note: 'Giao giờ hành chính',
      couponCode: 'FOODHUB10',
      paymentMethod: 'COD',
      items: [
        { dishId: 1, name: 'Phở tái nạm', quantity: 2, note: 'Ít hành' },
        { dishId: 2, name: 'Quẩy giòn giòn (cặp)', quantity: 3, note: '' }
      ]
    })
  });

  assert.strictEqual(createOrder.status, 201, 'Tạo đơn hàng thành công');
  const order = createOrder.data.data;
  console.log('✓ Đơn hàng tạo thành công! Mã đơn:', order.code);
  console.log('  - Tạm tính:', order.subtotal, 'đ (Mong đợi: 65k*2 + 10k*3 = 160k)');
  console.log('  - Phí ship:', order.shippingFee, 'đ (Dưới 200k là 15k)');
  console.log('  - Giảm giá:', order.discount, 'đ (10% của 160k = 16k)');
  console.log('  - Tổng tiền:', order.total, 'đ (160k + 15k - 16k = 159k)');
  assert.strictEqual(order.subtotal, 160000);
  assert.strictEqual(order.shippingFee, 15000);
  assert.strictEqual(order.discount, 16000);
  assert.strictEqual(order.total, 159000);
  assert.strictEqual(order.status, 'pending');

  // 7. Kiểm tra giỏ hàng đã tự động được dọn dẹp sau khi đặt đơn
  console.log('\n[7] Kiểm tra giỏ hàng sau khi đặt hàng...');
  const checkEmptyCart = await request('/cart', {
    method: 'GET',
    headers: userHeaders
  });
  assert.strictEqual(checkEmptyCart.data.data.items.length, 0);
  console.log('✓ Giỏ hàng đã được xóa sạch sau khi đặt hàng.');

  // 8. Khách hàng kiểm tra danh sách đơn của mình (GET /api/orders/my)
  console.log('\n[8] Khách hàng kiểm tra danh sách đơn cá nhân (GET /api/orders/my)...');
  const myOrders = await request('/orders/my', {
    method: 'GET',
    headers: userHeaders
  });
  assert.strictEqual(myOrders.status, 200);
  const foundOrder = myOrders.data.data.find(o => o.code === order.code);
  assert.ok(foundOrder, 'Đơn hàng mới tạo có trong danh sách đơn của khách');
  console.log('✓ Tìm thấy đơn hàng trong danh sách cá nhân, tổng số đơn:', myOrders.data.total);

  // 9. Khách hàng xem chi tiết đơn hàng (GET /api/orders/:id)
  console.log('\n[9] Khách hàng xem chi tiết đơn (GET /api/orders/' + order.code + ')...');
  const orderDetail = await request(`/orders/${order.code}`, {
    method: 'GET',
    headers: userHeaders
  });
  assert.strictEqual(orderDetail.status, 200);
  assert.strictEqual(orderDetail.data.data.code, order.code);
  console.log('✓ Lấy chi tiết đơn thành công.');

  // 10. Khách hàng hủy đơn pending (PATCH /api/orders/:id/cancel)
  console.log('\n[10] Khách hàng hủy đơn pending...');
  const cancelRes = await request(`/orders/${order.code}/cancel`, {
    method: 'PATCH',
    headers: userHeaders,
    body: JSON.stringify({ reason: 'Đổi địa chỉ giao hàng' })
  });
  assert.strictEqual(cancelRes.status, 200);
  assert.strictEqual(cancelRes.data.data.status, 'cancelled');
  console.log('✓ Hủy đơn pending thành công. Trạng thái hiện tại:', cancelRes.data.data.status);

  // 11. Tạo thêm đơn thứ hai để test quy trình Admin duyệt
  console.log('\n[11] Tạo đơn hàng thứ 2 để kiểm thử quyền Admin...');
  const verificationToken2 = await getEmailVerificationToken('khachhang@foodhub.vn');

  const createOrder2 = await request('/orders', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      restaurantId: 2, // Bún Chả Hương Liên
      recipientName: 'Trần Thị Thu Thảo',
      recipientPhone: '0977665544',
      contactEmail: 'khachhang@foodhub.vn',
      emailVerificationToken: verificationToken2,
      deliveryAddress: '24 Lê Văn Hưu, Hai Bà Trưng, Hà Nội',
      note: 'Mang thêm ớt tỏi',
      paymentMethod: 'COD',
      items: [
        { dishId: 0, name: 'Bún chả đặc biệt', quantity: 2 }, // 60k * 2 = 120k
        { dishId: 1, name: 'Combo Obama', quantity: 1 }      // 105k * 1 = 105k -> Subtotal = 225k -> Freeship!
      ]
    })
  });
  assert.strictEqual(createOrder2.status, 201);
  const order2 = createOrder2.data.data;
  console.log('✓ Đơn 2 tạo thành công:', order2.code, '| Tạm tính:', order2.subtotal, '| Phí ship:', order2.shippingFee, '(Freeship vì >= 200k)');
  assert.strictEqual(order2.subtotal, 225000);
  assert.strictEqual(order2.shippingFee, 0);
  assert.strictEqual(order2.total, 225000);

  // 12. Admin xem danh sách tất cả đơn hàng (GET /api/orders/admin/all)
  console.log('\n[12] Admin xem danh sách đơn toàn hệ thống...');
  const adminAllOrders = await request('/orders/admin/all', {
    method: 'GET',
    headers: adminHeaders
  });
  assert.strictEqual(adminAllOrders.status, 200);
  console.log('✓ Admin xem được toàn bộ', adminAllOrders.data.total, 'đơn hàng');

  // 13. Admin kiểm tra thống kê (GET /api/orders/admin/stats)
  console.log('\n[13] Admin lấy thống kê đơn hàng...');
  const adminStats = await request('/orders/admin/stats', {
    method: 'GET',
    headers: adminHeaders
  });
  assert.strictEqual(adminStats.status, 200);
  console.log('✓ Thống kê:', adminStats.data.data);

  // 14. Admin cập nhật trạng thái đơn 2: pending -> confirmed -> preparing -> shipping -> completed
  console.log('\n[14] Admin cập nhật quy trình trạng thái đơn 2...');
  const statuses = ['confirmed', 'preparing', 'shipping', 'completed'];
  for (const st of statuses) {
    const patchRes = await request(`/orders/${order2.code}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: st, note: `Admin test ${st}` })
    });
    assert.strictEqual(patchRes.status, 200);
    assert.strictEqual(patchRes.data.data.status, st);
    if (st === 'completed') {
      assert.strictEqual(patchRes.data.data.paymentStatus, 'paid');
    }
    console.log(`  ✓ Cập nhật sang "${st}" thành công. PaymentStatus: ${patchRes.data.data.paymentStatus}`);
  }

  // 15. Thống kê lại sau khi hoàn tất đơn
  console.log('\n[15] Kiểm tra lại thống kê doanh thu sau khi đơn 2 hoàn tất...');
  const finalStats = await request('/orders/admin/stats', {
    method: 'GET',
    headers: adminHeaders
  });
  console.log('✓ Doanh thu hoàn tất hiện tại:', finalStats.data.data.totalRevenue, 'đ');
  assert.ok(finalStats.data.data.totalRevenue >= 210000);

  console.log('\n======================================================');
  console.log('🎉 TẤT CẢ 15/15 BÀI KIỂM THỬ GIỎ HÀNG & ĐẶT MÓN ĐỀU ĐẠT CHUẨN 100%!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err);
  process.exit(1);
});
