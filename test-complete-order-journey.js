import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import app from './server/index.js';
import { getDb } from './server/db.js';

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

async function runSimulation() {
  console.log('======================================================================');
  console.log('  MÔ PHỎNG TOÀN DIỆN HÀNH TRÌNH ĐẶT HÀNG: PHỞ THÌN LÒ ĐÚC & CHECKOUT   ');
  console.log('======================================================================\n');

  // 1. Kiểm tra Health Check
  console.log('[1] Kiểm tra API Health Check...');
  const healthRes = await request('/api/health');
  assert(healthRes.status === 200, 'GET /api/health trả về HTTP 200');
  assert(healthRes.data?.status === 'ok', 'Máy chủ API hoạt động bình thường');

  // 2. Đăng nhập người dùng
  console.log('\n[2] Đăng nhập tài khoản khách hàng (khachhang@foodhub.vn)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  assert(loginRes.status === 200, 'Đăng nhập thành công');
  const token = loginRes.data.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Khách hàng vào trang chi tiết quán Phở Thìn Lò Đúc
  console.log('\n[3] Khách hàng xem trang chi tiết quán Phở Thìn Lò Đúc (ID: 1)...');
  const restRes = await request('/api/restaurants/1');
  assert(restRes.status === 200, 'Tải thành công thông tin quán Phở Thìn Lò Đúc');
  const restaurant = restRes.data.data;
  assert(Array.isArray(restaurant.menu), 'Quán có thực đơn món ăn');

  const trungGa = restaurant.menu.find(m => m.name.toLowerCase().includes('trứng gà trần'));
  const phoTaiLan = restaurant.menu.find(m => m.name.toLowerCase().includes('tái lăn'));
  assert(Boolean(trungGa && trungGa.id && trungGa.priceNum), `Món Trứng gà trần có ID hợp lệ (#${trungGa?.id}) và priceNum (${trungGa?.priceNum} đ)`);
  assert(Boolean(phoTaiLan && phoTaiLan.id && phoTaiLan.priceNum), `Món Phở tái lăn có ID hợp lệ (#${phoTaiLan?.id}) và priceNum (${phoTaiLan?.priceNum} đ)`);

  // 4. Thêm món vào giỏ hàng và đồng bộ lên server
  console.log('\n[4] Thêm 2 món vào giỏ hàng: Trứng gà trần (2 suất) & Phở tái lăn (1 suất)...');
  const cartData = {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address,
    items: [
      {
        dishId: trungGa.id,
        id: trungGa.id,
        name: trungGa.name,
        price: trungGa.price,
        priceNum: trungGa.priceNum,
        quantity: 2,
        note: 'Trần lòng đào'
      },
      {
        dishId: phoTaiLan.id,
        id: phoTaiLan.id,
        name: phoTaiLan.name,
        price: phoTaiLan.price,
        priceNum: phoTaiLan.priceNum,
        quantity: 1,
        note: 'Ít bánh phở'
      }
    ]
  };

  const saveCartRes = await request('/api/cart', {
    method: 'POST',
    headers: authHeaders,
    body: cartData
  });
  assert(saveCartRes.status === 200, 'Đồng bộ giỏ hàng lên server thành công');
  assert(saveCartRes.data.data?.items?.length === 2, 'Giỏ hàng có đủ 2 món');

  // 5. Khách hàng vào trang giỏ hàng, tăng số lượng Trứng gà trần lên 3 và tải lại trang
  console.log('\n[5] Chỉnh sửa số lượng món Trứng gà trần lên 3 và tải lại trang...');
  cartData.items[0].quantity = 3;
  const updateCartRes = await request('/api/cart', {
    method: 'POST',
    headers: authHeaders,
    body: cartData
  });
  assert(updateCartRes.status === 200, 'Cập nhật số lượng giỏ hàng thành công');

  // Giả lập tải lại trang bằng cách GET /api/cart
  const reloadCartRes = await request('/api/cart', {
    headers: authHeaders
  });
  assert(reloadCartRes.status === 200, 'Tải lại trang giỏ hàng thành công');
  const reloadedCart = reloadCartRes.data.data;
  const reloadedTrung = reloadedCart.items.find(i => i.dishId === trungGa.id || i.name === trungGa.name);
  assert(reloadedTrung?.quantity === 3, 'Số lượng Trứng gà trần sau khi reload trang vẫn là 3');

  // 6. Chuyển sang Checkout và Đặt hàng
  console.log('\n[6] Chuyển sang trang thanh toán và xác nhận đặt hàng...');
  const orderPayload = {
    restaurantId: restaurant.id,
    items: reloadedCart.items.map(i => ({
      dishId: i.dishId,
      id: i.id,
      name: i.name,
      priceNum: i.priceNum,
      quantity: i.quantity,
      note: i.note
    })),
    recipientName: 'Nguyễn Văn A',
    recipientPhone: '0988123456',
    deliveryAddress: 'Số 13 Lò Đúc, Hai Bà Trưng, Hà Nội',
    addressDetails: {
      province: 'Hà Nội',
      district: 'Hai Bà Trưng',
      ward: 'Phạm Đình Hổ',
      street: 'Số 13 Lò Đúc'
    },
    note: 'Giao nhanh giúp mình',
    paymentMethod: 'COD'
  };

  const placeOrderRes = await request('/api/orders', {
    method: 'POST',
    headers: authHeaders,
    body: orderPayload
  });

  assert(placeOrderRes.status === 201, 'Đặt hàng thành công với mã phản hồi HTTP 201 Created');
  assert(placeOrderRes.data.success === true, 'Response API trả về success: true');
  const order = placeOrderRes.data.data;
  assert(Boolean(order && order.code), `Mã đơn hàng được cấp: ${order?.code}`);
  assert(!JSON.stringify(placeOrderRes.data).includes('NaN'), 'Response đặt hàng TUYỆT ĐỐI KHÔNG chứa "NaN"');

  // 7. Kiểm tra chi tiết đơn hàng
  console.log('\n[7] Kiểm tra tính toàn vẹn của đơn hàng vừa tạo...');
  assert(order.restaurantId === 1, 'Đúng ID quán Phở Thìn Lò Đúc (1)');
  assert(order.restaurantName === 'Phở Thìn Lò Đúc', 'Đúng tên quán Phở Thìn Lò Đúc');
  assert(order.items.length === 2, 'Đơn hàng lưu đủ 2 món ăn');

  const orderTrung = order.items.find(i => i.name.toLowerCase().includes('trứng gà trần'));
  assert(orderTrung?.dishId === trungGa.id, `dishId của Trứng gà trần là #${trungGa.id}`);
  assert(orderTrung?.quantity === 3, 'Số lượng Trứng gà trần: 3 suất');
  assert(orderTrung?.priceNum === 10000, 'Đơn giá Trứng gà trần: 10.000 đ');
  assert(orderTrung?.total === 30000, 'Thành tiền Trứng gà trần: 30.000 đ');

  const expectedSubtotal = (10000 * 3) + phoTaiLan.priceNum; // 30k + 75k = 105k
  assert(order.subtotal === expectedSubtotal, `Tổng tiền món subtotal chính xác: ${expectedSubtotal.toLocaleString('vi-VN')} đ`);
  const expectedTotal = expectedSubtotal + 15000; // 105k + 15k = 120k
  assert(order.total === expectedTotal, `Tổng thanh toán gồm phí ship 15k: ${expectedTotal.toLocaleString('vi-VN')} đ`);

  // 8. Tải lại trang chi tiết đơn hàng (Order Tracking)
  console.log('\n[8] Khách hàng mở trang theo dõi đơn hàng (F5 / tải lại trang)...');
  const trackOrderRes = await request(`/api/orders/${order.code}`, {
    headers: authHeaders
  });
  assert(trackOrderRes.status === 200, 'GET /api/orders/:code thành công');
  const trackedOrder = trackOrderRes.data.data;
  assert(trackedOrder?.code === order.code, 'Mã đơn hàng khớp chính xác');
  assert(trackedOrder?.status === 'pending', 'Trạng thái ban đầu là "pending"');
  assert(trackedOrder?.items?.length === 2, 'Các món ăn và số lượng vẫn nguyên vẹn sau khi tải lại trang');

  // 9. Kiểm tra file cơ sở dữ liệu trên đĩa cứng
  console.log('\n[9] Đọc trực tiếp data/foodhub.json từ đĩa cứng để xác nhận tính bền vững...');
  const diskRaw = fs.readFileSync(path.resolve('./data/foodhub.json'), 'utf8');
  const diskDb = JSON.parse(diskRaw);
  const orderOnDisk = diskDb.orders.find(o => o.code === order.code);
  assert(Boolean(orderOnDisk), `Đơn hàng ${order.code} đã được lưu bền vững vào tệp data/foodhub.json`);
  assert(!JSON.stringify(orderOnDisk).includes('NaN'), 'Dữ liệu đơn hàng trên đĩa cứng KHÔNG chứa "NaN"');

  // 10. Đặt hàng quán khác để kiểm tra tính ổn định toàn hệ thống
  console.log('\n[10] Kiểm tra đặt hàng quán khác (Quán 3: Phở Gia Truyền Bát Đàn)...');
  const rest3Res = await request('/api/restaurants/3');
  const rest3 = rest3Res.data.data;
  const rest3Dish = rest3.menu[0];

  const orderRest3 = await request('/api/orders', {
    method: 'POST',
    headers: authHeaders,
    body: {
      restaurantId: 3,
      items: [{ dishId: rest3Dish.id, id: rest3Dish.id, name: rest3Dish.name, priceNum: rest3Dish.priceNum, quantity: 1 }],
      recipientName: 'Khách Test Quán Khác',
      recipientPhone: '0977665544',
      deliveryAddress: '49 Bát Đàn, Hoàn Kiếm, Hà Nội',
      paymentMethod: 'COD'
    }
  });
  assert(orderRest3.status === 201, 'Đặt hàng quán khác thành công (HTTP 201 Created)');
  assert(!JSON.stringify(orderRest3.data).includes('NaN'), 'Không có lỗi NaN ở các quán khác');

  console.log('\n======================================================================');
  console.log(`  KẾT QUẢ MÔ PHỎNG: ${passed} THÀNH CÔNG, ${failed} THẤT BẠI`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

runSimulation().catch(err => {
  console.error('Lỗi ngoại lệ:', err);
  process.exit(1);
});

