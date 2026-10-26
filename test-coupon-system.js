// FoodHub Coupon System End-to-End Verification Test
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import app from './server/index.js';
import { getDb, saveDb } from './server/db.js';

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

async function runTests() {
  console.log('====================================================');
  console.log('  TESTING FOODHUB COUPON SYSTEM END-TO-END');
  console.log('====================================================\n');

  // 1. Authenticate Admin and Customer
  console.log('--- 1. AUTHENTICATION ---');
  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@foodhub.vn', password: 'Admin@FoodHub2026!' }
  });
  const adminToken = adminLogin.data.data?.token;
  assert(adminLogin.ok && adminToken, 'Admin đăng nhập thành công, nhận token JWT');

  const custLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  const custToken = custLogin.data.data?.token;
  const custUser = custLogin.data.data?.user;
  assert(custLogin.ok && custToken, 'Customer đăng nhập thành công, nhận token JWT');

  // 2. Public coupons list
  console.log('\n--- 2. PUBLIC COUPON SUGGESTIONS API ---');
  const publicRes = await request('/api/coupons/public');
  assert(publicRes.ok && Array.isArray(publicRes.data.data), 'GET /api/coupons/public trả về danh sách mã giảm giá công khai');
  assert(publicRes.data.data.length > 0, `Có ${publicRes.data.data.length} mã giảm giá đang hoạt động cho khách hàng`);

  // 3. Admin creates a brand new coupon
  console.log('\n--- 3. ADMIN CREATES NEW COUPON ---');
  const testPromoCode = `PROMO${Date.now().toString().slice(-4)}`;
  const createRes = await request('/api/coupons/admin', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      code: testPromoCode,
      type: 'percent',
      value: 30,
      maxDiscount: 60000,
      minOrder: 100000,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      totalLimit: 50,
      perUserLimit: 2,
      scope: 'all',
      description: 'Giảm 30% tối đa 60.000 đ cho đơn từ 100k',
      isActive: true
    }
  });

  assert(createRes.status === 201, `Admin tạo thành công mã giảm giá ${testPromoCode}`);
  assert(createRes.data.data?.code === testPromoCode, 'Dữ liệu mã giảm giá lưu đúng trong hệ thống');
  const createdCouponId = createRes.data.data?.id;

  // 4. Customer immediately enters Admin's new coupon (No server restart required!)
  console.log('\n--- 4. CUSTOMER ENTERS ADMIN-CREATED COUPON ---');
  const validSubtotal = 150000;
  const validateRes = await request('/api/coupons/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      code: testPromoCode,
      subtotal: validSubtotal,
      restaurantId: 1
    }
  });

  assert(validateRes.ok && validateRes.data.valid === true, `Khách hàng nhập mã ${testPromoCode} -> Hệ thống tìm thấy và áp dụng thành công ngay lập tức!`);
  const expectedDiscount30 = Math.round((validSubtotal * 30) / 100); // 45,000
  assert(validateRes.data.discount === expectedDiscount30, `Mức giảm tính chính xác: 30% của ${validSubtotal.toLocaleString('vi-VN')} đ = ${expectedDiscount30.toLocaleString('vi-VN')} đ`);

  // 5. Test maxDiscount capping
  console.log('\n--- 5. DISCOUNT CAPPING & MIN ORDER ---');
  const largeSubtotal = 300000; // 30% = 90,000 -> capped at 60,000
  const capRes = await request('/api/coupons/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      code: testPromoCode,
      subtotal: largeSubtotal,
      restaurantId: 1
    }
  });
  assert(capRes.ok && capRes.data.discount === 60000, `Đơn hàng lớn ${largeSubtotal.toLocaleString('vi-VN')} đ -> Giảm giá bị chặn đúng mức trần tối đa 60.000 đ`);

  // Under minOrder
  const smallSubtotal = 50000; // < 100,000 minOrder
  const smallRes = await request('/api/coupons/validate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      code: testPromoCode,
      subtotal: smallSubtotal,
      restaurantId: 1
    }
  });
  assert(smallRes.status === 400 && smallRes.data.message.includes('100.000'), `Đơn hàng ${smallSubtotal.toLocaleString('vi-VN')} đ (< 100k) bị từ chối với thông báo rõ ràng về đơn tối thiểu: "${smallRes.data.message}"`);

  // 6. Test other coupon types: Fixed & Freeship
  console.log('\n--- 6. FIXED AND FREESHIP COUPONS ---');
  const fixedRes = await request('/api/coupons/validate', {
    method: 'POST',
    body: { code: 'BANMOI', subtotal: 100000, restaurantId: 1 }
  });
  assert(fixedRes.ok && fixedRes.data.discount === 20000, 'Mã BANMOI (fixed) giảm đúng 20.000 đ');

  const freeshipRes = await request('/api/coupons/validate', {
    method: 'POST',
    body: { code: 'FREESHIP', subtotal: 100000, restaurantId: 1 }
  });
  assert(freeshipRes.ok && freeshipRes.data.discount === 15000, 'Mã FREESHIP giảm đúng 15.000 đ phí giao hàng');

  // 7. Validation edge cases
  console.log('\n--- 7. VALIDATION EDGE CASES ---');
  // Non-existent
  const fakeRes = await request('/api/coupons/validate', {
    method: 'POST',
    body: { code: 'NOT_EXISTING_XYZ', subtotal: 100000 }
  });
  assert(fakeRes.status === 400 && fakeRes.data.message.includes('không tồn tại'), `Mã không tồn tại báo đúng: "${fakeRes.data.message}"`);

  // Admin toggles active state to false
  const toggleOffRes = await request(`/api/coupons/admin/${createdCouponId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {}
  });
  assert(toggleOffRes.ok && toggleOffRes.data.data?.isActive === false, `Admin tạm ngưng hoạt động mã ${testPromoCode}`);

  const inactiveRes = await request('/api/coupons/validate', {
    method: 'POST',
    body: { code: testPromoCode, subtotal: 150000 }
  });
  assert(inactiveRes.status === 400 && inactiveRes.data.message.includes('tạm ngưng'), `Mã bị tắt báo đúng: "${inactiveRes.data.message}"`);

  // Admin toggles active state back to true
  const toggleOnRes = await request(`/api/coupons/admin/${createdCouponId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {}
  });
  assert(toggleOnRes.ok && toggleOnRes.data.data?.isActive === true, `Admin kích hoạt lại mã ${testPromoCode}`);

  // 8. Order Placement with Admin Coupon & Usage Tracking
  console.log('\n--- 8. ORDER PLACEMENT WITH ADMIN-CREATED COUPON ---');
  const db = getDb();
  const rest1 = db.restaurants.find(r => r.id === 1 || r.id === '1');
  const dish1 = rest1.menu[0];

  const placeOrderRes = await request('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      restaurantId: rest1.id,
      items: [
        {
          id: dish1.id,
          dishId: dish1.id,
          name: dish1.name,
          price: dish1.price,
          quantity: 2
        }
      ],
      recipientName: 'Khách Hàng Thử Nghiệm',
      recipientPhone: '0987654321',
      deliveryAddress: 'Số 123 Đường Láng, Đống Đa, Hà Nội',
      paymentMethod: 'COD',
      couponCode: testPromoCode
    }
  });

  assert(placeOrderRes.ok && placeOrderRes.data.success, 'Đặt hàng thành công với mã giảm giá do Admin tạo');
  const placedOrder = placeOrderRes.data.data;
  assert(placedOrder.appliedCoupon === testPromoCode, `Đơn hàng ghi nhận đúng mã giảm giá đã áp dụng: ${placedOrder.appliedCoupon}`);
  assert(placedOrder.discount > 0, `Đơn hàng được giảm giá: ${placedOrder.discount.toLocaleString('vi-VN')} đ`);
  assert(placedOrder.total === Math.max(0, placedOrder.subtotal + placedOrder.shippingFee - placedOrder.discount), 'Tổng tiền đơn hàng tính toán chính xác tuyệt đối (subtotal + ship - discount)');

  // Verify coupon usage in DB
  const dbAfter = getDb();
  const updatedCoupon = dbAfter.coupons.find(c => c.id === createdCouponId);
  assert(updatedCoupon && updatedCoupon.usedCount === 1, `Lượt sử dụng của mã ${testPromoCode} tăng lên 1 (usedCount = 1)`);
  assert(updatedCoupon.usedBy?.some(u => u.userId === custUser.id), 'Lịch sử sử dụng ghi nhận chính xác ID khách hàng');

  // 9. Admin cleanup
  console.log('\n--- 9. ADMIN COUPON CLEANUP ---');
  const deleteRes = await request(`/api/coupons/admin/${createdCouponId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(deleteRes.ok, `Admin xóa dọn dẹp mã giảm giá test ${testPromoCode} thành công`);

  console.log('\n====================================================');
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
