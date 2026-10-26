// Comprehensive Automated Test Suite for FoodHub (15 Mandatory Business Scenarios)
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import app from './server/index.js';
import { getDb } from './server/db.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
    results.push({ name: testName, pass: true });
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    results.push({ name: testName, pass: false, error: details });
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
    const normalizedHeaders = {};
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        normalizedHeaders[k.toLowerCase()] = v;
      }
    }

    req.headers = {
      host: 'localhost',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload).toString(),
      ...normalizedHeaders
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
          data
        });
      }
    });

    app.handle(req, res);
  });
}

async function run() {
  console.log('\n===============================================================');
  console.log('   FOODHUB FULL TEST SUITE - 15 MANDATORY BUSINESS SCENARIOS   ');
  console.log('===============================================================\n');

  try {
    // -------------------------------------------------------------
    // PREPARATION: LOGIN ADMIN & CUSTOMER 1 & CUSTOMER 2
    // -------------------------------------------------------------
    console.log('[CHUẨN BỊ] Đăng nhập các tài khoản thử nghiệm...');
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@foodhub.vn', password: 'Admin@FoodHub2026!' }
    });
    const adminToken = adminLogin.data.data?.token;

    const cust1Login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
    });
    const cust1Token = cust1Login.data.data?.token;

    const cust2Login = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'thuthao@foodhub.vn', password: 'Khach@FoodHub2026!' }
    });
    const cust2Token = cust2Login.data.data?.token;

    assert(Boolean(adminToken), 'Đăng nhập Quản trị viên (admin@foodhub.vn)');
    assert(Boolean(cust1Token), 'Đăng nhập Khách hàng 1 (khachhang@foodhub.vn)');
    assert(Boolean(cust2Token), 'Đăng nhập Khách hàng 2 (thuthao@foodhub.vn)');

    // -------------------------------------------------------------
    // KỊCH BẢN 1: Bình luận tức thì (status: 'approved' ngay lập tức)
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 1: Bình luận hiển thị ngay (status: approved) ---');
    const rev1Res = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        rating: 5,
        content: `Món ăn tuyệt vời tại Cơm Tấm Sài Gòn #${Date.now()}!`
      }
    });
    assert(rev1Res.status === 201, 'POST /api/reviews trả về 201 Created');
    assert(rev1Res.data.data?.status === 'approved', 'Bình luận được duyệt tức thì (status: approved)');
    const rev1Id = rev1Res.data.data?.id;

    // Kiểm tra danh sách công khai có ngay bình luận vừa tạo
    const pubRevRes = await request('/api/reviews/restaurant/1');
    const foundRev1 = (pubRevRes.data.data || []).find(r => r.id === rev1Id);
    assert(Boolean(foundRev1), 'Bình luận hiển thị ngay lập tức trong API công khai của quán mà không cần chờ duyệt');

    // -------------------------------------------------------------
    // KỊCH BẢN 2: Khách hàng bình luận nhiều lần không giới hạn
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 2: Khách hàng bình luận nhiều lần trên cùng 1 quán ---');
    const rev2Res = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        rating: 4,
        content: `Quay lại ăn lần hai #${Date.now()} vẫn rất ưng ý sườn nướng!`
      }
    });
    assert(rev2Res.status === 201, 'Khách hàng gửi tiếp bình luận thứ 2 thành công');
    const rev2Id = rev2Res.data.data?.id;
    assert(rev1Id !== rev2Id, 'Hai bình luận có ID hoàn toàn riêng biệt, không ghi đè');

    const pubRevRes2 = await request('/api/reviews/restaurant/1');
    const hasRev1 = pubRevRes2.data.data?.some(r => r.id === rev1Id);
    const hasRev2 = pubRevRes2.data.data?.some(r => r.id === rev2Id);
    assert(hasRev1 && hasRev2, 'Cả hai bình luận cùng tồn tại đầy đủ trên quán');

    // -------------------------------------------------------------
    // KỊCH BẢN 3: Chặn spam bình luận trùng nội dung trong vòng 30s
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 3: Chống spam bình luận trùng nội dung trong 30s ---');
    const spamContent = `Nội dung thử nghiệm chống spam trùng lặp ${Date.now()}`;
    await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { restaurantId: 2, rating: 5, content: spamContent }
    });

    const spamAttempt = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { restaurantId: 2, rating: 5, content: spamContent }
    });
    assert((spamAttempt.status === 429 || spamAttempt.status === 400) && spamAttempt.data.spam === true, 'Hệ thống phát hiện spam và chặn bình luận trùng nội dung trong 30s');

    // -------------------------------------------------------------
    // KỊCH BẢN 4: Khách hàng chỉnh sửa bình luận của chính mình
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 4: Khách hàng sửa bình luận của chính mình ---');
    const updatedContent = `Nội dung đã được chỉnh sửa lúc ${Date.now()}`;
    const editRes = await request(`/api/reviews/${rev2Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { rating: 5, content: updatedContent }
    });
    assert(editRes.status === 200, 'PUT /api/reviews/:id thành công 200 OK');
    assert(editRes.data.data?.content === updatedContent, 'Nội dung bình luận được cập nhật chính xác');
    assert(editRes.data.data?.rating === 5, 'Số sao đánh giá được cập nhật thành công');

    // -------------------------------------------------------------
    // KỊCH BẢN 5: Khách hàng xóa bình luận của chính mình & tính lại sao
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 5: Khách hàng xóa bình luận của mình & tính lại sao ---');
    const delRes = await request(`/api/reviews/${rev2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    assert(delRes.status === 200, 'DELETE /api/reviews/:id thành công 200 OK');

    const checkDelRes = await request('/api/reviews/restaurant/1');
    const isGone = !checkDelRes.data.data?.some(r => r.id === rev2Id);
    assert(isGone, 'Bình luận đã được xóa khỏi hệ thống');

    // -------------------------------------------------------------
    // KỊCH BẢN 6: Bảo mật phân quyền - Chặn sửa/xóa bình luận của người khác
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 6: Chặn sửa/xóa bình luận của người khác (403 Forbidden) ---');
    const attackEdit = await request(`/api/reviews/${rev1Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cust2Token}` },
      body: { rating: 1, content: 'Cố tình sửa đánh giá của người khác' }
    });
    assert(attackEdit.status === 403, 'Chặn khách hàng 2 sửa bình luận của khách hàng 1 (403 Forbidden)');

    const attackDel = await request(`/api/reviews/${rev1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cust2Token}` }
    });
    assert(attackDel.status === 403, 'Chặn khách hàng 2 xóa bình luận của khách hàng 1 (403 Forbidden)');

    // -------------------------------------------------------------
    // KỊCH BẢN 7: Xác thực số điện thoại di động Việt Nam chuẩn
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 7: Kiểm tra định dạng số điện thoại Việt Nam ---');
    const rest1 = (await request('/api/restaurants/1')).data.data;
    const realDish = rest1.menu[0];
    const realPrice = realDish.priceNum || (parseInt(String(realDish.price).replace(/[^\d]/g, ''), 10) || 75000);

    const invalidPhoneCheckout = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 1 }],
        recipientName: 'Test Phone',
        recipientPhone: '0123456789', // Invalid prefix 01
        deliveryAddress: 'Số 1 Cầu Giấy, Hà Nội',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        street: 'Số 1 Cầu Giấy',
        paymentMethod: 'cod'
      }
    });
    assert(invalidPhoneCheckout.status === 400, 'Từ chối số điện thoại đầu số không hợp lệ 01 (400 Bad Request)');

    const validPhoneCheckout = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 1 }],
        recipientName: 'Test Phone',
        recipientPhone: '+84988776655', // Valid +84 format
        deliveryAddress: 'Số 1 Cầu Giấy, Hà Nội',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng',
        street: 'Số 1 Cầu Giấy',
        paymentMethod: 'cod'
      }
    });
    assert(validPhoneCheckout.status === 201, 'Chấp nhận số điện thoại định dạng chuẩn (+84988776655)');
    assert(validPhoneCheckout.data.data?.recipientPhone === '0988776655', 'Tự động chuẩn hóa +84 thành đầu 0 (0988776655)');

    // -------------------------------------------------------------
    // KỊCH BẢN 8: Sổ địa chỉ giao hàng trong trang hồ sơ cá nhân
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 8: Sổ địa chỉ giao hàng trong Profile ---');
    const addAddrRes = await request('/api/auth/addresses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        recipientName: 'Nguyễn Văn A',
        phone: '0988123456',
        province: 'Hà Nội',
        district: 'Cầu Giấy',
        ward: 'Dịch Vọng Hậu',
        street: 'Ngõ 20 Duy Tân, Tòa FPT',
        isDefault: true
      }
    });
    assert(addAddrRes.status === 200, 'POST /api/auth/addresses thêm địa chỉ thành công');
    const createdAddrId = addAddrRes.data.data?.id;

    const listAddrRes = await request('/api/auth/addresses', {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const addrFound = (listAddrRes.data.data || []).find(a => a.id === createdAddrId);
    assert(Boolean(addrFound), 'GET /api/auth/addresses trả về đúng địa chỉ vừa tạo');
    assert(addrFound?.isDefault === true, 'Địa chỉ được đánh dấu mặc định chính xác');

    // -------------------------------------------------------------
    // KỊCH BẢN 9: Backend tính toán lại giá, KHÔNG tin tưởng frontend
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 9: Backend xác thực giá gốc món ăn từ Database ---');
    // Giả lập hacker gửi giá 1đ lên server
    const forgedOrderRes = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 2, price: 1, name: realDish.name }], // Giả giá 1đ
        recipientName: 'Test Price Hacker',
        recipientPhone: '0988112233',
        deliveryAddress: 'Hà Nội',
        paymentMethod: 'cod'
      }
    });
    assert(forgedOrderRes.status === 201, 'Tạo đơn hàng kiểm tra giá thành công');
    const expectedSubtotal = realPrice * 2;
    assert(forgedOrderRes.data.data?.subtotal === expectedSubtotal, `Backend tính toán giá từ DB (${expectedSubtotal.toLocaleString('vi-VN')} đ), chặn giá giả mạo 1đ`);

    // -------------------------------------------------------------
    // KỊCH BẢN 10: Xác thực và khấu trừ mã giảm giá (Coupon validation)
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 10: Xác thực mã giảm giá & khấu trừ ---');
    const valGoodCoupon = await request('/api/coupons/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { code: 'FOODHUB10', subtotal: 100000, restaurantId: 1 }
    });
    assert(valGoodCoupon.status === 200 && valGoodCoupon.data.valid === true, 'Mã FOODHUB10 hợp lệ với đơn 100k');
    assert(valGoodCoupon.data.discount === 10000, 'Mức giảm 10% của 100k là 10.000 đ');

    const valMinOrderFail = await request('/api/coupons/validate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { code: 'GIAM50K', subtotal: 50000, restaurantId: 1 } // GIAM50K requires 200k
    });
    assert(valMinOrderFail.data.valid === false, 'Chặn mã GIAM50K khi đơn hàng chưa đạt mức tối thiểu 200.000 đ');

    // -------------------------------------------------------------
    // KỊCH BẢN 11: Phương thức thanh toán COD và Chuyển khoản (Bank Transfer)
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 11: Phương thức thanh toán COD và Chuyển khoản VietQR ---');
    const codOrder = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 1 }],
        recipientName: 'Khách COD',
        recipientPhone: '0988123456',
        deliveryAddress: 'Hà Nội',
        paymentMethod: 'cod'
      }
    });
    assert(codOrder.data.data?.paymentMethod === 'COD', 'Đơn COD ghi nhận đúng paymentMethod: COD');
    assert(codOrder.data.data?.paymentStatus === 'unpaid', 'Đơn COD có trạng thái thanh toán ban đầu là unpaid');

    const bankingOrder = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 1 }],
        recipientName: 'Khách Chuyển Khoản',
        recipientPhone: '0988123456',
        deliveryAddress: 'Hà Nội',
        paymentMethod: 'banking'
      }
    });
    assert(bankingOrder.data.data?.paymentMethod === 'BANK_TRANSFER', 'Đơn Banking ghi nhận đúng paymentMethod: BANK_TRANSFER');
    assert(bankingOrder.data.data?.paymentStatus === 'unpaid', 'Đơn Banking chờ thanh toán qua VietQR');

    // -------------------------------------------------------------
    // KỊCH BẢN 12: Vòng đời 7 bước theo dõi trạng thái đơn hàng
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 12: Vòng đời 7 bước trạng thái đơn hàng (Tracking) ---');
    const trackingOrderId = codOrder.data.data.id;
    const stages = ['confirmed', 'preparing', 'ready', 'shipping', 'completed'];

    for (const st of stages) {
      const patchRes = await request(`/api/orders/${trackingOrderId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: st, note: `Admin chuyển sang ${st}` }
      });
      assert(patchRes.status === 200, `Admin chuyển trạng thái đơn sang "${st}" thành công`);
    }

    const finalOrderRes = await request(`/api/orders/${trackingOrderId}`, {
      headers: { Authorization: `Bearer ${cust1Token}` }
    });
    const finalOrder = finalOrderRes.data.data;
    assert(finalOrder?.status === 'completed', 'Đơn hàng đạt trạng thái cuối cùng completed');
    assert(finalOrder?.timeline?.length >= 6, `Đơn hàng lưu đầy đủ nhật ký tiến trình (timeline: ${finalOrder?.timeline?.length} bước)`);

    // -------------------------------------------------------------
    // KỊCH BẢN 13: Hủy đơn hợp lệ (pending/confirmed/preparing) & Hoàn lại coupon
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 13: Hủy đơn hàng hợp lệ & Hoàn trả số lượt dùng coupon ---');
    // Tạo đơn với mã coupon FOODHUB10
    const couponBefore = (await request('/api/coupons/admin/all', {
      headers: { Authorization: `Bearer ${adminToken}` }
    })).data.data.find(c => c.code === 'FOODHUB10');
    const usedCountBefore = couponBefore.usedCount || 0;

    const cancellableOrder = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 1 }],
        couponCode: 'FOODHUB10',
        recipientName: 'Khách Hủy Đơn',
        recipientPhone: '0988123456',
        deliveryAddress: 'Hà Nội',
        paymentMethod: 'cod'
      }
    });
    const cancelOrderId = cancellableOrder.data.data.id;

    // Hủy đơn
    const cancelRes = await request(`/api/orders/${cancelOrderId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { reason: 'Tôi muốn thay đổi địa chỉ nhận hàng' }
    });
    assert(cancelRes.status === 200, 'Khách hàng hủy đơn ở trạng thái pending thành công');
    assert(cancelRes.data.data?.status === 'cancelled', 'Trạng thái đơn chuyển thành cancelled');
    assert(cancelRes.data.data?.cancelReason === 'Tôi muốn thay đổi địa chỉ nhận hàng', 'Lý do hủy đơn được lưu đầy đủ');

    // Kiểm tra coupon được hoàn trả lượt dùng
    const couponAfter = (await request('/api/coupons/admin/all', {
      headers: { Authorization: `Bearer ${adminToken}` }
    })).data.data.find(c => c.code === 'FOODHUB10');
    assert(couponAfter.usedCount === usedCountBefore, 'Số lượt sử dụng coupon được hoàn trả chính xác sau khi hủy đơn');

    // -------------------------------------------------------------
    // KỊCH BẢN 14: Chặn hủy đơn khi đã sẵn sàng giao hoặc đang giao
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 14: Chặn hủy đơn khi quán đã hoàn thành (ready/shipping/completed) ---');
    const unCancellableOrder = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: {
        restaurantId: 1,
        items: [{ id: realDish.id, quantity: 1 }],
        recipientName: 'Khách',
        recipientPhone: '0988123456',
        deliveryAddress: 'Hà Nội',
        paymentMethod: 'cod'
      }
    });
    const blockOrderId = unCancellableOrder.data.data.id;

    // Admin chuyển sang 'ready'
    await request(`/api/orders/${blockOrderId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'ready' }
    });

    // Khách hàng cố tình gửi yêu cầu hủy
    const blockedCancelRes = await request(`/api/orders/${blockOrderId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${cust1Token}` },
      body: { reason: 'Muốn hủy khi món đã sẵn sàng' }
    });
    assert(blockedCancelRes.status === 400, 'Chặn hủy đơn thành công khi trạng thái là ready (400 Bad Request)');

    // -------------------------------------------------------------
    // KỊCH BẢN 15: Admin Coupon CRUD, Bảo vệ tài khoản và An toàn dữ liệu
    // -------------------------------------------------------------
    console.log('\n--- KỊCH BẢN 15: Admin Coupon CRUD & Bảo vệ an toàn tài khoản người dùng ---');
    // 15a: Tạo coupon mới
    const newCouponRes = await request('/api/coupons/admin', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        code: `PROMO${Date.now()}`,
        type: 'percent',
        value: 20,
        maxDiscount: 50000,
        minOrder: 150000,
        description: 'Giảm 20% cho đơn từ 150k'
      }
    });
    assert(newCouponRes.status === 201, 'Admin tạo coupon mới thành công');
    const createdCouponId = newCouponRes.data.data?.id;

    // 15b: Toggle status
    const toggleRes = await request(`/api/coupons/admin/${createdCouponId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(toggleRes.status === 200, 'Admin đổi trạng thái Bật/Tắt coupon thành công');

    // 15c: Delete coupon
    const delCouponRes = await request(`/api/coupons/admin/${createdCouponId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(delCouponRes.status === 200, 'Admin xóa coupon thành công');

    // 15d: Bảo vệ tài khoản khách hàng không bị xóa
    const deleteCustAttempt = await request('/api/admin/users/2', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(deleteCustAttempt.status === 403, 'Bảo vệ tài khoản khách hàng: Admin bị từ chối xóa tài khoản khách hàng (403 Forbidden)');

    // 15e: Kiểm tra toàn bộ 6 tài khoản người dùng gốc được giữ nguyên
    const db = getDb();
    const expectedEmails = [
      'admin@foodhub.vn',
      'khachhang@foodhub.vn',
      'thuthao@foodhub.vn',
      'lyhoang230607@gmail.com',
      'dsandlsadjlsa@gmail.com',
      'lyhuy230607@gmail.com'
    ];
    const allEmailsPreserved = expectedEmails.every(em => db.users.some(u => u.email === em));
    assert(allEmailsPreserved, 'Tất cả 6 tài khoản người dùng gốc được bảo toàn nguyên vẹn trong Database');

    // 15f: Kiểm tra số lượng quán ăn và thực đơn phong phú
    assert(db.restaurants.length >= 30, `Hệ thống có đầy đủ trên 30 quán ăn mẫu phong phú (Hiện có: ${db.restaurants.length} quán)`);
    const totalDishes = db.restaurants.reduce((acc, r) => acc + (r.menu ? r.menu.length : 0), 0);
    assert(totalDishes >= 100, `Thực đơn phong phú với hơn 100 món ăn chi tiết (Hiện có: ${totalDishes} món)`);

  } catch (err) {
    console.error('[LỖI NGOẠI LỆ TRONG QUÁ TRÌNH TEST]:', err);
    failed++;
  } finally {
    console.log('\n===============================================================');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} THÀNH CÔNG, ${failed} THẤT BẠI`);
    console.log('===============================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

run();
