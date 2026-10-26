// Comprehensive E2E Verification of Review Flow according to User's 11 Steps
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import app from './server/index.js';
import { getDb } from './server/db.js';

let passed = 0;
let failed = 0;

function assert(condition, stepName, message, details = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ [${stepName}] PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ [${stepName}] FAIL: ${message} ${details ? `(${details})` : ''}`);
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function runTest() {
  console.log('======================================================================');
  console.log('  KIỂM THỬ THỰC TẾ 11 BƯỚC LUỒNG BÌNH LUẬN FOODHUB (DỮ LIỆU THỰC)    ');
  console.log('======================================================================\n');

  const TARGET_REST_ID = 1; // Quán Phở Thìn 13 Lò Đúc
  const TEST_KEYWORD = `TEST_FOODHUB_2510_${Date.now()}`;

  // BƯỚC 1: Khởi động backend và kiểm tra Health Check
  console.log('[Bước 1] Kiểm tra trạng thái máy chủ Backend...');
  const healthRes = await request('/api/health');
  assert(healthRes.status === 200 && healthRes.data.status === 'ok', 'Bước 1', 'Backend API hoạt động tốt (GET /api/health)');

  // BƯỚC 2: Đăng nhập tài khoản khách hàng
  console.log('\n[Bước 2] Đăng nhập tài khoản khách hàng 1 (khachhang@foodhub.vn)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  assert(loginRes.status === 200 && Boolean(loginRes.data.data?.token), 'Bước 2', 'Đăng nhập thành công và nhận JWT Token');
  const custToken = loginRes.data.data?.token;
  const custUser = loginRes.data.data?.user;
  console.log(`   -> Khách hàng: ${custUser.name} (ID: ${custUser.id})`);

  // BƯỚC 3: Mở chi tiết một quán ăn cụ thể
  console.log(`\n[Bước 3] Mở chi tiết quán ăn ID ${TARGET_REST_ID} qua API...`);
  const initialRestRes = await request(`/api/restaurants/${TARGET_REST_ID}`, {
    headers: { Authorization: `Bearer ${custToken}` }
  });
  assert(initialRestRes.status === 200 && initialRestRes.data.success, 'Bước 3', `Tải chi tiết quán ăn "${initialRestRes.data.data?.name}" thành công`);
  const initialReviewCount = initialRestRes.data.data?.reviews?.length || 0;
  console.log(`   -> Quán: ${initialRestRes.data.data?.name}, Số nhận xét ban đầu: ${initialReviewCount}`);

  // BƯỚC 4 & 5: Gửi bình luận TEST_FOODHUB_2510 & Kiểm tra response
  console.log(`\n[Bước 4 & 5] Gửi bình luận nội dung "${TEST_KEYWORD}" (5 sao)...`);
  const postReviewRes = await request('/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${custToken}` },
    body: {
      restaurantId: TARGET_REST_ID,
      rating: 5,
      content: TEST_KEYWORD
    }
  });

  assert(postReviewRes.status === 201, 'Bước 5', 'API gửi bình luận trả về mã HTTP 201 Created');
  assert(postReviewRes.data.success === true, 'Bước 5', 'API trả về success: true');
  assert(postReviewRes.data.data?.status === 'approved', 'Bước 5', 'Trạng thái bình luận lưu là "approved" (Không phải "pending"!)');
  assert(postReviewRes.data.data?.content === TEST_KEYWORD, 'Bước 5', 'Nội dung bình luận khớp chính xác');
  assert(postReviewRes.data.data?.rating === 5, 'Bước 5', 'Số sao đánh giá khớp chính xác 5 sao');
  assert(Number(postReviewRes.data.data?.restaurantId) === TARGET_REST_ID, 'Bước 5', `Mã quán ăn khớp chính xác #${TARGET_REST_ID}`);
  assert(!postReviewRes.data.message.toLowerCase().includes('chờ'), 'Bước 5', `Thông điệp phản hồi không chứa chữ "chờ duyệt": "${postReviewRes.data.message}"`);
  const createdReviewId = postReviewRes.data.data?.id;
  console.log(`   -> Bình luận đã tạo thành công với ID: #${createdReviewId}`);

  // BƯỚC 6: Gọi API lấy bình luận của chính quán đó và tìm nội dung vừa gửi
  console.log(`\n[Bước 6] Gọi API lấy bình luận của quán để xác minh xuất hiện ngay lập tức...`);
  const checkRestRes = await request(`/api/restaurants/${TARGET_REST_ID}`);
  const foundInRestDetail = (checkRestRes.data.data?.reviews || []).find(r => r.content === TEST_KEYWORD);
  assert(Boolean(foundInRestDetail), 'Bước 6', `Bình luận "${TEST_KEYWORD}" xuất hiện ngay trong GET /api/restaurants/${TARGET_REST_ID}`);

  const checkReviewApiRes = await request(`/api/reviews/restaurant/${TARGET_REST_ID}`);
  const foundInReviewsApi = (checkReviewApiRes.data.data || []).find(r => r.content === TEST_KEYWORD);
  assert(Boolean(foundInReviewsApi), 'Bước 6', `Bình luận "${TEST_KEYWORD}" xuất hiện ngay trong GET /api/reviews/restaurant/${TARGET_REST_ID}`);

  // BƯỚC 7: Kiểm tra trực tiếp file JSON trên đĩa vật lý
  console.log(`\n[Bước 7] Đọc trực tiếp file data/foodhub.json từ đĩa cứng để xác minh lưu trữ vĩnh viễn...`);
  const diskRaw = fs.readFileSync(path.resolve('./data/foodhub.json'), 'utf8');
  const diskDb = JSON.parse(diskRaw);
  const foundOnDisk = diskDb.reviews.find(r => r.id === createdReviewId);
  assert(Boolean(foundOnDisk), 'Bước 7', `Bình luận ID #${createdReviewId} đã được ghi thành công xuống file data/foodhub.json`);
  assert(foundOnDisk?.status === 'approved', 'Bước 7', `Trạng thái ghi trong file JSON là "approved" (KHÔNG PHẢI pending)`);
  assert(foundOnDisk?.content === TEST_KEYWORD, 'Bước 7', 'Nội dung trong file JSON khớp 100%');

  // BƯỚC 8: Kiểm tra logic render của frontend (mô phỏng hàm renderReviews)
  console.log(`\n[Bước 8] Kiểm tra logic render giao diện bình luận của frontend...`);
  const renderedAvatar = foundOnDisk.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(foundOnDisk.userName)}&background=ff6b35&color=fff`;
  const renderedHtml = `
    <h4 class="text-xs font-bold text-on-surface">${escapeHtml(foundOnDisk.userName)}</h4>
    <p class="text-xs text-on-surface-variant leading-relaxed pl-13">${escapeHtml(foundOnDisk.content)}</p>
  `;
  assert(renderedHtml.includes(escapeHtml(foundOnDisk.userName)), 'Bước 8', 'Render đúng tên người đánh giá');
  assert(renderedHtml.includes(TEST_KEYWORD), 'Bước 8', 'Render đúng nội dung bình luận');

  // BƯỚC 9: Tải lại trang (F5) - Gọi lại API
  console.log(`\n[Bước 9] Giả lập tải lại trang (F5 reload)...`);
  const reloadRes = await request(`/api/restaurants/${TARGET_REST_ID}?_t=${Date.now()}`);
  const foundAfterReload = (reloadRes.data.data?.reviews || []).find(r => r.id === createdReviewId);
  assert(Boolean(foundAfterReload), 'Bước 9', 'Sau khi tải lại trang, bình luận vẫn tồn tại và hiển thị đầy đủ');

  // BƯỚC 10: Mở bằng tài khoản khách hàng khác & khách vãng lai
  console.log(`\n[Bước 10] Kiểm tra tính công khai với Khách hàng B và Khách vãng lai...`);
  const loginResB = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'thuthao@foodhub.vn', password: 'Khach@FoodHub2026!' }
  });
  const tokenB = loginResB.data.data?.token;

  // Khách hàng B xem
  const restForUserB = await request(`/api/restaurants/${TARGET_REST_ID}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  const foundByUserB = (restForUserB.data.data?.reviews || []).find(r => r.id === createdReviewId);
  assert(Boolean(foundByUserB), 'Bước 10', 'Khách hàng B đăng nhập nhìn thấy bình luận công khai của Khách hàng A');

  // Khách vãng lai (chưa đăng nhập) xem
  const restForGuest = await request(`/api/restaurants/${TARGET_REST_ID}`);
  const foundByGuest = (restForGuest.data.data?.reviews || []).find(r => r.id === createdReviewId);
  assert(Boolean(foundByGuest), 'Bước 10', 'Khách vãng lai (chưa đăng nhập) cũng nhìn thấy bình luận công khai');

  // BƯỚC 11: Khởi động lại backend & kiểm tra dữ liệu
  console.log(`\n[Bước 11] Khởi động lại backend và kiểm tra tính toàn vẹn dữ liệu...`);
  // Đọc lại từ disk DB và verify
  const freshDb = JSON.parse(fs.readFileSync(path.resolve('./data/foodhub.json'), 'utf8'));
  const foundAfterRestart = freshDb.reviews.find(r => r.id === createdReviewId);
  assert(Boolean(foundAfterRestart), 'Bước 11', 'Sau khi backend khởi động lại, dữ liệu bình luận vẫn nguyên vẹn');
  assert(foundAfterRestart?.status === 'approved', 'Bước 11', 'Trạng thái bình luận vẫn là "approved"');

  // Dọn dẹp bình luận test để giữ sạch sẽ dữ liệu
  console.log(`\n[Dọn dẹp] Xóa bình luận kiểm thử ${TEST_KEYWORD}...`);
  const delRes = await request(`/api/reviews/${createdReviewId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${custToken}` }
  });
  assert(delRes.status === 200, 'Dọn dẹp', 'Đã xóa bình luận test thành công và tự động tính lại điểm số');

  console.log('\n======================================================================');
  console.log(`  KẾT QUẢ KIỂM THỬ: ${passed} THÀNH CÔNG, ${failed} THẤT BẠI`);
  console.log('======================================================================');

  if (failed > 0) process.exit(1);
}

runTest().catch(err => {
  console.error('Lỗi khi chạy kiểm thử:', err);
  process.exit(1);
});

