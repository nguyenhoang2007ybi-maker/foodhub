// Test đặt hàng món 'Trứng gà trần' tại Phở Thìn Lò Đúc và kiểm tra loại bỏ lỗi NaN
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

async function run() {
  console.log('======================================================================');
  console.log('  KIỂM THỬ ĐẶT HÀNG THỰC TẾ: MÓN "TRỨNG GÀ TRẦN" & LOẠI BỎ LỖI NaN    ');
  console.log('======================================================================\n');

  // 1. Đăng nhập khách hàng
  console.log('[1] Đăng nhập tài khoản khách hàng mẫu (khachhang@foodhub.vn)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  assert(loginRes.status === 200, 'Đăng nhập khách hàng thành công');
  const token = loginRes.data.data?.token;

  // 2. Mở thực đơn quán Phở Thìn Lò Đúc
  console.log('\n[2] Lấy thông tin thực đơn quán Phở Thìn Lò Đúc (ID: 1)...');
  const rest1Res = await request('/api/restaurants/1');
  assert(rest1Res.status === 200, 'Tải chi tiết quán Phở Thìn Lò Đúc thành công');
  const phoThin = rest1Res.data.data;
  assert(phoThin && Array.isArray(phoThin.menu), 'Quán có danh sách thực đơn menu');

  // Tìm món "Trứng gà trần"
  const trungGaTran = phoThin.menu.find(m => m.name.toLowerCase().includes('trứng gà trần') || m.name.toLowerCase().includes('trứng chần'));
  assert(Boolean(trungGaTran), 'Tìm thấy món Trứng gà trần trong thực đơn');
  console.log(`   -> Thông tin món: ID #${trungGaTran.id}, Tên: "${trungGaTran.name}", Giá: ${trungGaTran.priceNum}đ (${trungGaTran.price})`);
  assert(typeof trungGaTran.id === 'number' && !isNaN(trungGaTran.id), 'ID món ăn là số nguyên hợp lệ, không phải NaN');
  assert(trungGaTran.priceNum === 10000, 'Giá số priceNum chuẩn xác 10.000 đ');

  // 3. Thử nghiệm giỏ hàng: Cập nhật giỏ hàng chứa món Trứng gà trần
  console.log('\n[3] Cập nhật giỏ hàng với món "Trứng gà trần" (2 suất)...');
  const cartUpdateRes = await request('/api/cart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      restaurantId: 1,
      restaurantName: phoThin.name,
      restaurantAddress: phoThin.address,
      items: [
        {
          dishId: trungGaTran.id,
          id: trungGaTran.id,
          name: trungGaTran.name,
          price: trungGaTran.price,
          priceNum: trungGaTran.priceNum,
          quantity: 2,
          note: 'Trần lòng đào kỹ'
        }
      ]
    }
  });
  assert(cartUpdateRes.status === 200, 'Cập nhật giỏ hàng thành công');
  const savedCartItem = cartUpdateRes.data.data?.items?.[0];
  assert(savedCartItem?.dishId === trungGaTran.id, `Giỏ hàng lưu đúng dishId: ${trungGaTran.id}`);
  assert(!isNaN(savedCartItem?.dishId), 'dishId trong giỏ không bị NaN');
  assert(savedCartItem?.name === trungGaTran.name, 'Tên món trong giỏ khớp chính xác');

  // 4. Kiểm tra tương thích giỏ hàng cũ (Legacy Cart): món chỉ có tên mà thiếu dishId
  console.log('\n[4] Giả lập giỏ hàng cũ chỉ có tên "Trứng gà trần" thiếu ID -> Tự động nhận diện...');
  const legacyCartRes = await request('/api/cart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      restaurantId: 1,
      restaurantName: phoThin.name,
      restaurantAddress: phoThin.address,
      items: [
        {
          name: 'Trứng gà trần',
          price: '10.000đ',
          priceNum: 10000,
          quantity: 2,
          note: ''
        }
      ]
    }
  });
  assert(legacyCartRes.status === 200, 'Gửi giỏ hàng cũ thành công');
  const healedItem = legacyCartRes.data.data?.items?.[0];
  assert(healedItem?.dishId === trungGaTran.id, `Hệ thống tự động phân giải ID món thành ${trungGaTran.id}`);
  assert(!isNaN(healedItem?.dishId), 'ID được phân giải là số hợp lệ (KHÔNG BỊ NaN)');

  // 5. Tiến hành đặt hàng thực tế món Trứng gà trần tại Phở Thìn Lò Đúc
  console.log('\n[5] Tiến hành gửi đơn đặt hàng thực tế món "Trứng gà trần" + "Phở tái lăn đặc biệt"...');
  const phoTaiLan = phoThin.menu.find(m => m.name.toLowerCase().includes('tái lăn'));

  const placeOrderRes = await request('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      restaurantId: 1,
      items: [
        {
          dishId: trungGaTran.id,
          id: trungGaTran.id,
          name: trungGaTran.name,
          quantity: 2,
          priceNum: 10000,
          note: 'Trần nước béo thơm'
        },
        {
          dishId: phoTaiLan.id,
          id: phoTaiLan.id,
          name: phoTaiLan.name,
          quantity: 1,
          priceNum: phoTaiLan.priceNum,
          note: 'Nhiều hành lá'
        }
      ],
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0988123456',
      deliveryAddress: 'Số 13 Lò Đúc, Hai Bà Trưng, Hà Nội',
      addressDetails: {
        province: 'Hà Nội',
        district: 'Hai Bà Trưng',
        ward: 'Phạm Đình Hổ',
        street: 'Số 13 Lò Đúc'
      },
      note: 'Giao nhanh giúp mình nhé',
      paymentMethod: 'COD'
    }
  });

  assert(placeOrderRes.status === 201, `Tạo đơn hàng thành công (HTTP 201 Created)`);
  assert(placeOrderRes.data.success === true, 'Response trả về success: true');
  const createdOrder = placeOrderRes.data.data;
  assert(Boolean(createdOrder && createdOrder.code), `Đơn hàng được cấp mã: ${createdOrder?.code}`);
  assert(!JSON.stringify(placeOrderRes.data).includes('NaN'), 'Response đơn hàng hoàn toàn KHÔNG chứa chữ "NaN"');

  // Kiểm tra chi tiết đơn hàng
  console.log('\n[6] Xác minh chi tiết đơn hàng đã lưu trong hệ thống...');
  assert(createdOrder.restaurantId === 1, 'Đúng mã quán Phở Thìn Lò Đúc (ID: 1)');
  assert(createdOrder.restaurantName === 'Phở Thìn Lò Đúc', 'Đúng tên quán: Phở Thìn Lò Đúc');
  assert(createdOrder.items.length === 2, 'Đơn hàng có đủ 2 món ăn');

  const orderItemTrung = createdOrder.items.find(i => i.name.toLowerCase().includes('trứng gà trần'));
  assert(Boolean(orderItemTrung), 'Đơn hàng chứa đúng món "Trứng gà trần"');
  assert(orderItemTrung?.dishId === trungGaTran.id, `dishId của Trứng gà trần là #${trungGaTran.id}`);
  assert(orderItemTrung?.quantity === 2, 'Số lượng: 2 suất');
  assert(orderItemTrung?.priceNum === 10000, 'Đơn giá: 10.000 đ');
  assert(orderItemTrung?.total === 20000, 'Thành tiền Trứng gà trần: 20.000 đ');

  const expectedSubtotal = (10000 * 2) + phoTaiLan.priceNum;
  assert(createdOrder.subtotal === expectedSubtotal, `Tổng tiền món subtotal chính xác: ${expectedSubtotal} đ`);
  assert(createdOrder.total === expectedSubtotal + 15000, `Tổng thanh toán gồm phí ship 15k: ${createdOrder.total} đ`);

  // 7. Kiểm tra dữ liệu thực lưu trong file data/foodhub.json trên đĩa cứng
  console.log('\n[7] Đọc trực tiếp file data/foodhub.json từ đĩa cứng...');
  const diskRaw = fs.readFileSync(path.resolve('./data/foodhub.json'), 'utf8');
  const diskDb = JSON.parse(diskRaw);
  const orderOnDisk = diskDb.orders.find(o => o.code === createdOrder.code);
  assert(Boolean(orderOnDisk), `Đơn hàng ${createdOrder.code} đã được lưu an toàn xuống file vật lý data/foodhub.json`);
  assert(!JSON.stringify(orderOnDisk).includes('NaN'), 'Dữ liệu đơn hàng trong file JSON hoàn toàn không chứa "NaN"');

  // 8. Kiểm thử các quán khác để đảm bảo không làm hỏng chức năng chung
  console.log('\n[8] Kiểm tra đặt hàng quán khác (Quán 2: Bún Chả Hương Liên)...');
  const rest2 = diskDb.restaurants.find(r => r.id === 2);
  const bunChaItem = rest2.menu[0];
  const orderRest2Res = await request('/api/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      restaurantId: 2,
      items: [
        {
          dishId: bunChaItem.id,
          id: bunChaItem.id,
          name: bunChaItem.name,
          quantity: 1,
          priceNum: bunChaItem.priceNum
        }
      ],
      recipientName: 'Nguyễn Văn A',
      recipientPhone: '0988123456',
      deliveryAddress: '24 Lê Văn Hưu, Hà Nội',
      paymentMethod: 'COD'
    }
  });
  assert(orderRest2Res.status === 201, 'Đặt hàng thành công tại Bún Chả Hương Liên');
  assert(!JSON.stringify(orderRest2Res.data).includes('NaN'), 'Không có lỗi NaN ở quán khác');

  console.log('\n======================================================================');
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passed} THÀNH CÔNG, ${failed} THẤT BẠI`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Lỗi ngoại lệ trong quá trình test:', err);
  process.exit(1);
});

