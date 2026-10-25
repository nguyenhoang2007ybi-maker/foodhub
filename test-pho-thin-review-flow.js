// E2E Simulation Test for Phở Thìn Review Flow
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
          data
        });
      }
    });

    app.handle(req, res);
  });
}

async function runPhothinTest() {
  console.log('===============================================================');
  console.log('  KIỂM THỬ THỰC TẾ LUỒNG BÌNH LUẬN - ĐÁNH GIÁ QUÁN PHỞ THÌN   ');
  console.log('===============================================================\n');

  try {
    // 1. Khách A đăng nhập
    console.log('[Bước 1] Khách hàng A (khachhang@foodhub.vn) đăng nhập...');
    const custALogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'khachhang@foodhub.vn', password: 'Khach@FoodHub2026!' }
    });
    assert(custALogin.status === 200, 'Khách hàng A đăng nhập thành công');
    const tokenA = custALogin.data.data?.token;
    const userA = custALogin.data.data?.user;

    // Lấy thông tin ban đầu của Phở Thìn
    const initialPhoThin = (await request('/api/restaurants/1')).data.data;
    const initialCount = initialPhoThin.reviewsCount || 0;
    const initialRating = initialPhoThin.rating || 0;
    console.log(`  -> Trạng thái ban đầu Phở Thìn: ${initialRating} sao, ${initialCount} nhận xét\n`);

    // 2. Khách A đánh giá quán Phở Thìn (5 sao)
    console.log('[Bước 2] Khách hàng A gửi đánh giá 5 sao cho quán Phở Thìn...');
    const uniqueReviewContent1 = `Phở Thìn nước béo thơm ngậy ngập hành, chuẩn vị Hà Nội #${Date.now()}!`;
    const submitRevRes = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        restaurantId: 1,
        rating: 5,
        content: uniqueReviewContent1
      }
    });

    assert(submitRevRes.status === 201, 'Gửi đánh giá thành công (HTTP 201 Created)');
    assert(submitRevRes.data.data?.status === 'approved', 'Đánh giá được tự động phê duyệt ngay lập tức (status: approved)');
    assert(submitRevRes.data.data?.userName === userA.name, 'Lưu đúng tên khách hàng thực hiện đánh giá');
    assert(submitRevRes.data.data?.rating === 5, 'Lưu đúng số sao đánh giá (5 sao)');
    const rev1Id = submitRevRes.data.data?.id;

    // 3. Đánh giá xuất hiện ngay lập tức bên dưới quán (Không cần admin duyệt, không reload)
    console.log('\n[Bước 3] Kiểm tra đánh giá xuất hiện ngay lập tức dưới quán Phở Thìn...');
    const afterReviewPhoThin = (await request('/api/restaurants/1')).data.data;
    const foundRevInDetail = afterReviewPhoThin.reviews.find(r => r.id === rev1Id);
    assert(Boolean(foundRevInDetail), 'Đánh giá mới xuất hiện ngay lập tức trong danh sách nhận xét của Phở Thìn');
    assert(foundRevInDetail?.content === uniqueReviewContent1, 'Nội dung nhận xét hiển thị chính xác đầy đủ');
    assert(afterReviewPhoThin.reviewsCount === initialCount + 1, `Số lượng nhận xét tăng chính xác từ ${initialCount} lên ${afterReviewPhoThin.reviewsCount}`);

    // 4. Giả lập tải lại trang (F5): Đánh giá vẫn còn lưu bền vững
    console.log('\n[Bước 4] Giả lập tải lại trang (Reload): Đánh giá vẫn còn lưu trữ đầy đủ trong DB...');
    const reloadedPhoThin = (await request('/api/restaurants/1')).data.data;
    const persistentRev = reloadedPhoThin.reviews.find(r => r.id === rev1Id);
    assert(Boolean(persistentRev), 'Tải lại trang, đánh giá vẫn được duy trì đầy đủ');

    // 5. Đăng nhập tài khoản khác (Khách B - thuthao@foodhub.vn)
    console.log('\n[Bước 5] Đăng nhập tài khoản khác (Khách hàng B) để kiểm tra tính công khai...');
    const custBLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'thuthao@foodhub.vn', password: 'Khach@FoodHub2026!' }
    });
    const tokenB = custBLogin.data.data?.token;
    assert(Boolean(tokenB), 'Khách hàng B đăng nhập thành công');

    const phoThinFromCustB = (await request('/api/restaurants/1', {
      headers: { Authorization: `Bearer ${tokenB}` }
    })).data.data;
    const canSeeCustAReview = phoThinFromCustB.reviews.some(r => r.id === rev1Id);
    assert(canSeeCustAReview, 'Khách hàng B nhìn thấy công khai đánh giá của Khách hàng A');

    // Khách không đăng nhập cũng nhìn thấy công khai
    const phoThinAnonymous = (await request('/api/restaurants/1')).data.data;
    assert(phoThinAnonymous.reviews.some(r => r.id === rev1Id), 'Khách vãng lai chưa đăng nhập cũng xem được đánh giá công khai');

    // 6. Gửi thêm nhiều đánh giá: Tất cả đều được hiển thị
    console.log('\n[Bước 6] Khách hàng A gửi tiếp đánh giá thứ 2 (4 sao) trên cùng quán Phở Thìn...');
    const uniqueReviewContent2 = `Lần này gọi thêm bát phở tái nạm sốt vang #${Date.now()}, vẫn ngon!`;
    const submitRevRes2 = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        restaurantId: 1,
        rating: 4,
        content: uniqueReviewContent2
      }
    });
    assert(submitRevRes2.status === 201, 'Khách hàng A gửi tiếp đánh giá thứ 2 thành công');
    const rev2Id = submitRevRes2.data.data?.id;
    assert(rev1Id !== rev2Id, 'Hai đánh giá có ID riêng biệt, không ghi đè lẫn nhau');

    const phoThinWithMultiReviews = (await request('/api/restaurants/1')).data.data;
    const hasRev1 = phoThinWithMultiReviews.reviews.some(r => r.id === rev1Id);
    const hasRev2 = phoThinWithMultiReviews.reviews.some(r => r.id === rev2Id);
    assert(hasRev1 && hasRev2, 'Tất cả các đánh giá của khách hàng đều cùng hiển thị đầy đủ bên dưới quán');
    assert(phoThinWithMultiReviews.reviewsCount === initialCount + 2, `Tổng số lượng đánh giá tăng lên ${phoThinWithMultiReviews.reviewsCount}`);

    // 7. Khách A chỉnh sửa đánh giá thứ 2 của mình
    console.log('\n[Bước 7] Khách hàng A chỉnh sửa đánh giá thứ 2 của mình...');
    const updatedContent2 = `Đã quay lại lần thứ ba lúc #${Date.now()} và nâng điểm lên 5 sao!`;
    const editRes = await request(`/api/reviews/${rev2Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { rating: 5, content: updatedContent2 }
    });
    assert(editRes.status === 200, 'Khách hàng A sửa đánh giá của chính mình thành công (200 OK)');
    assert(editRes.data.data?.content === updatedContent2, 'Nội dung cập nhật hiển thị chính xác');
    assert(editRes.data.data?.rating === 5, 'Số sao cập nhật thành công lên 5 sao');

    // 8. Bảo mật: Khách B không được phép sửa hoặc xóa đánh giá của Khách A
    console.log('\n[Bước 8] Bảo mật phân quyền: Khách B cố tình sửa hoặc xóa đánh giá của Khách A...');
    const attackEdit = await request(`/api/reviews/${rev1Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { rating: 1, content: 'Bị hack đánh giá' }
    });
    assert(attackEdit.status === 403, 'Chặn Khách B sửa đánh giá của Khách A (403 Forbidden)');

    const attackDelete = await request(`/api/reviews/${rev1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(attackDelete.status === 403, 'Chặn Khách B xóa đánh giá của Khách A (403 Forbidden)');

    // 9. Khách A xóa đánh giá thứ 2: Điểm trung bình và số lượng được tính lại ngay
    console.log('\n[Bước 9] Khách hàng A xóa đánh giá thứ 2: Tính lại điểm và số lượng...');
    const deleteRes = await request(`/api/reviews/${rev2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(deleteRes.status === 200, 'Khách hàng A xóa đánh giá của mình thành công');

    const phoThinAfterDelete = (await request('/api/restaurants/1')).data.data;
    const isRev2Gone = !phoThinAfterDelete.reviews.some(r => r.id === rev2Id);
    assert(isRev2Gone, 'Đánh giá thứ 2 đã được xóa khỏi danh sách hiển thị');
    assert(phoThinAfterDelete.reviewsCount === initialCount + 1, `Số lượng đánh giá giảm về ${phoThinAfterDelete.reviewsCount} chính xác`);

    // 10. Chống gửi rỗng & Yêu cầu đăng nhập khi chưa có token
    console.log('\n[Bước 10] Kiểm tra validation dữ liệu đầu vào & Bắt buộc đăng nhập...');
    const noAuthReview = await request('/api/reviews', {
      method: 'POST',
      body: { restaurantId: 1, rating: 5, content: 'Chưa đăng nhập' }
    });
    assert(noAuthReview.status === 401, 'Khách chưa đăng nhập bị chặn (HTTP 401 Unauthorized)');

    const emptyContentReview = await request('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { restaurantId: 1, rating: 5, content: '   ' }
    });
    assert(emptyContentReview.status === 400, 'Chặn gửi nội dung trống hoặc quá ngắn (HTTP 400 Bad Request)');

  } catch (err) {
    console.error('LỖI BẤT NGỜ:', err);
    failed++;
  } finally {
    console.log('\n===============================================================');
    console.log(`KẾT QUẢ KIỂM THỬ PHỞ THÌN: ${passed} THÀNH CÔNG, ${failed} THẤT BẠI`);
    console.log('===============================================================\n');

    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runPhothinTest();

