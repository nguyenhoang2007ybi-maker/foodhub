import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
  ADMIN_CANCEL_REASONS,
  CUSTOMER_CANCEL_REASONS,
  RESTAURANT_CANCEL_REASONS
} from './shared/orderCancellation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.TEST_CANCEL_PORT || 3100);
const BASE_URL = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}${detail ? ` | ${detail}` : ''}`);
  }
}

function reasonByCode(list, code) {
  return list.find(item => item.code === code);
}

async function request(endpoint, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startServer(dbFile) {
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      FOODHUB_DB_FILE: dbFile,
      NODE_ENV: 'test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  child.getOutput = () => output;
  return child;
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`Server thoát sớm:\n${server.getOutput()}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) return;
    } catch {
      // Server chưa sẵn sàng
    }
    await sleep(200);
  }
  throw new Error(`Server không khởi động kịp:\n${server.getOutput()}`);
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  await new Promise(resolve => {
    server.once('exit', resolve);
    server.kill();
    setTimeout(resolve, 3000);
  });
}

async function registerUser(name, email) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: {
      name,
      email,
      phone: '0912345678',
      password: 'Test@123456',
      confirmPassword: 'Test@123456'
    }
  });
  if (result.status !== 201 || !result.data?.data?.token) {
    throw new Error(`Không đăng ký được ${email}: ${JSON.stringify(result.data)}`);
  }
  return {
    token: result.data.data.token,
    user: result.data.data.user
  };
}

async function login(email, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (result.status !== 200 || !result.data?.data?.token) {
    throw new Error(`Không đăng nhập được ${email}: ${JSON.stringify(result.data)}`);
  }
  return {
    token: result.data.data.token,
    user: result.data.data.user
  };
}

async function getRestaurant(id) {
  const result = await request(`/restaurants/${id}`);
  if (result.status !== 200 || !result.data?.data) {
    throw new Error(`Không lấy được quán ${id}: ${JSON.stringify(result.data)}`);
  }
  return result.data.data;
}

async function createOrder(token, restaurantId, restaurant) {
  const dish = (restaurant.menu || []).find(item => item.isAvailable !== false && Number(item.priceNum) > 0);
  if (!dish) throw new Error(`Quán ${restaurantId} không có món hợp lệ để test.`);

  const result = await request('/orders', {
    method: 'POST',
    token,
    body: {
      restaurantId,
      items: [{
        dishId: dish.id,
        restaurantId,
        name: dish.name,
        priceNum: dish.priceNum,
        quantity: 1
      }],
      recipientName: 'Khách Kiểm Thử',
      recipientPhone: '0912345678',
      deliveryAddress: '123 Đường Kiểm Thử, Hà Nội',
      note: '',
      paymentMethod: 'COD'
    }
  });

  if (result.status !== 201 || !result.data?.data?.id) {
    throw new Error(`Không tạo được đơn hàng: ${JSON.stringify(result.data)}`);
  }
  return result.data.data;
}

async function cancelOrder(token, orderId, body) {
  return request(`/orders/${orderId}/cancel`, {
    method: 'PATCH',
    token,
    body
  });
}

async function updateAdminStatus(token, orderId, status, expectedStatus) {
  return request(`/orders/${orderId}/status`, {
    method: 'PATCH',
    token,
    body: { status, expectedStatus }
  });
}

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'foodhub-cancel-test-'));
  const tempDb = path.join(tempDir, 'foodhub.json');
  fs.copyFileSync(path.join(__dirname, 'data', 'foodhub.json'), tempDb);

  let server = startServer(tempDb);

  try {
    await waitForServer(server);
    console.log('========================================================');
    console.log('BẮT ĐẦU KIỂM THỬ CHỨC NĂNG HỦY ĐƠN FOODHUB');
    console.log('========================================================');

    const admin = await login('admin@foodhub.vn', 'Admin@FoodHub2026!');
    assert(admin.user.role === 'admin', 'Đăng nhập tài khoản Admin');

    const stamp = Date.now();
    const customerA = await registerUser('Khách Hủy A', `cancel-a-${stamp}@foodhub.test`);
    const customerB = await registerUser('Khách Hủy B', `cancel-b-${stamp}@foodhub.test`);
    const restaurantUser = await registerUser('Chủ Quán 1', `cancel-rest-${stamp}@foodhub.test`);

    const assignResult = await request(`/admin/users/${restaurantUser.user.id}`, {
      method: 'PUT',
      token: admin.token,
      body: { role: 'restaurant', restaurantId: 1 }
    });
    assert(
      assignResult.status === 200 && assignResult.data?.data?.role === 'restaurant',
      'Admin gán tài khoản chủ quán cho quán #1',
      JSON.stringify(assignResult.data)
    );

    const restaurantLogin = await login(`cancel-rest-${stamp}@foodhub.test`, 'Test@123456');
    assert(
      restaurantLogin.user.role === 'restaurant' && Number(restaurantLogin.user.restaurantId) === 1,
      'Tài khoản chủ quán nhận đúng vai trò và quán quản lý'
    );

    const restaurant1 = await getRestaurant(1);
    const restaurant2 = await getRestaurant(2);

    console.log('\n[1] Khách hàng hủy đơn của chính mình với lý do hợp lệ');
    const ownOrder = await createOrder(customerA.token, 1, restaurant1);
    const ownCancel = await cancelOrder(customerA.token, ownOrder.id, {
      reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'wrong_item').code,
      note: 'Tôi chọn nhầm món',
      expectedStatus: 'pending'
    });
    assert(ownCancel.status === 200 && ownCancel.data?.success, 'Hủy đơn thành công');
    assert(ownCancel.data?.data?.status === 'cancelled', 'Trạng thái đơn chuyển thành cancelled');
    assert(ownCancel.data?.data?.cancelledBy === 'customer', 'cancelledBy = customer');
    assert(ownCancel.data?.data?.cancelledById === customerA.user.id, 'cancelledById lấy từ tài khoản đăng nhập');
    assert(ownCancel.data?.data?.cancelledByName === customerA.user.name, 'cancelledByName lấy từ tài khoản đăng nhập');
    assert(Boolean(ownCancel.data?.data?.cancelledAt), 'Có cancelledAt');
    assert(ownCancel.data?.data?.cancelReason === 'Đặt nhầm món', 'Lưu đúng lý do hủy');
    assert(ownCancel.data?.data?.cancelNote === 'Tôi chọn nhầm món', 'Lưu ghi chú hủy');
    const ownTimelineEvent = (ownCancel.data?.data?.timeline || []).find(event => event.status === 'cancelled');
    assert(
      ownTimelineEvent?.fromStatus === 'pending' &&
      ownTimelineEvent?.toStatus === 'cancelled' &&
      ownTimelineEvent?.cancelledBy === 'customer',
      'Timeline có sự kiện hủy do backend tạo'
    );

    console.log('\n[2] Khách hàng không thể hủy đơn của người khác');
    const otherCustomerOrder = await createOrder(customerA.token, 1, restaurant1);
    const otherCustomerCancel = await cancelOrder(customerB.token, otherCustomerOrder.id, {
      reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'personal_plan').code
    });
    assert(otherCustomerCancel.status === 403, 'Bị từ chối 403', JSON.stringify(otherCustomerCancel.data));
    const otherCustomerOrderCheck = await request(`/orders/${otherCustomerOrder.id}`, { token: customerA.token });
    assert(otherCustomerOrderCheck.data?.data?.status === 'pending', 'Đơn của khách A giữ nguyên trạng thái');

    console.log('\n[3] Quán hủy đơn thuộc quán mình với lý do hợp lệ');
    const restaurantOrder = await createOrder(customerA.token, 1, restaurant1);
    const restaurantCancel = await cancelOrder(restaurantLogin.token, restaurantOrder.id, {
      reason: reasonByCode(RESTAURANT_CANCEL_REASONS, 'out_of_stock').code,
      note: 'Hết nguyên liệu món chính',
      expectedStatus: 'pending'
    });
    assert(restaurantCancel.status === 200, 'Quán hủy đơn thành công', JSON.stringify(restaurantCancel.data));
    assert(restaurantCancel.data?.data?.cancelledBy === 'restaurant', 'cancelledBy = restaurant');
    assert(restaurantCancel.data?.data?.cancelledById === restaurantLogin.user.id, 'cancelledById là tài khoản chủ quán');

    console.log('\n[4] Quán không thể hủy đơn thuộc quán khác');
    const otherRestaurantOrder = await createOrder(customerA.token, 2, restaurant2);
    const otherRestaurantCancel = await cancelOrder(restaurantLogin.token, otherRestaurantOrder.id, {
      reason: reasonByCode(RESTAURANT_CANCEL_REASONS, 'temporarily_closed').code
    });
    assert(otherRestaurantCancel.status === 403, 'Bị từ chối 403', JSON.stringify(otherRestaurantCancel.data));
    const otherRestaurantCheck = await request(`/orders/${otherRestaurantOrder.id}`, { token: customerA.token });
    assert(otherRestaurantCheck.data?.data?.status === 'pending', 'Đơn của quán khác giữ nguyên trạng thái');

    console.log('\n[5] Gửi yêu cầu hủy không có lý do');
    const noReasonOrder = await createOrder(customerA.token, 1, restaurant1);
    const noReasonCancel = await cancelOrder(customerA.token, noReasonOrder.id, { note: 'Thiếu lý do' });
    assert(noReasonCancel.status === 400, 'Bị từ chối 400', JSON.stringify(noReasonCancel.data));
    assert(noReasonCancel.data?.code === 'INVALID_CANCEL_REASON', 'Mã lỗi INVALID_CANCEL_REASON');

    console.log('\n[6] Chọn "Lý do khác" nhưng không nhập mô tả');
    const otherNoNoteOrder = await createOrder(customerA.token, 1, restaurant1);
    const otherNoNoteCancel = await cancelOrder(customerA.token, otherNoNoteOrder.id, {
      reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'other').code,
      note: ''
    });
    assert(otherNoNoteCancel.status === 400, 'Bị từ chối 400', JSON.stringify(otherNoNoteCancel.data));

    console.log('\n[7] Khách hàng giả mạo cancelledBy = restaurant');
    const spoofOrder = await createOrder(customerA.token, 1, restaurant1);
    const spoofCancel = await cancelOrder(customerA.token, spoofOrder.id, {
      reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'other').code,
      note: 'Lý do cụ thể của khách hàng',
      cancelledBy: 'restaurant',
      cancelledById: 999999,
      cancelledByName: 'Quán Giả Mạo'
    });
    assert(spoofCancel.status === 200, 'Yêu cầu được xử lý với danh tính thật');
    assert(spoofCancel.data?.data?.cancelledBy === 'customer', 'Giá trị giả mạo bị bỏ qua, cancelledBy = customer');
    assert(spoofCancel.data?.data?.cancelledById === customerA.user.id, 'ID giả mạo bị bỏ qua');
    assert(spoofCancel.data?.data?.cancelledByName === customerA.user.name, 'Tên giả mạo bị bỏ qua');

    console.log('\n[8] Hủy đơn đã hoàn thành');
    const completedOrder = await createOrder(customerA.token, 1, restaurant1);
    let statusResult = await updateAdminStatus(admin.token, completedOrder.id, 'confirmed', 'pending');
    assert(statusResult.status === 200, 'Chuyển đơn sang confirmed');
    statusResult = await updateAdminStatus(admin.token, completedOrder.id, 'preparing', 'confirmed');
    assert(statusResult.status === 200, 'Chuyển đơn sang preparing');
    statusResult = await updateAdminStatus(admin.token, completedOrder.id, 'shipping', 'preparing');
    assert(statusResult.status === 200, 'Chuyển đơn sang shipping');
    statusResult = await updateAdminStatus(admin.token, completedOrder.id, 'completed', 'shipping');
    assert(statusResult.status === 200, 'Chuyển đơn sang completed');
    const completedCancel = await cancelOrder(customerA.token, completedOrder.id, {
      reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'change_order').code
    });
    assert(completedCancel.status === 409, 'Bị từ chối 409', JSON.stringify(completedCancel.data));
    assert(completedCancel.data?.code === 'ORDER_COMPLETED', 'Mã lỗi ORDER_COMPLETED');

    console.log('\n[9] Hủy lại đơn đã bị hủy');
    const reCancel = await cancelOrder(customerA.token, ownOrder.id, {
      reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'change_order').code
    });
    assert(reCancel.status === 409, 'Bị từ chối 409', JSON.stringify(reCancel.data));
    assert(reCancel.data?.code === 'ORDER_ALREADY_CANCELLED', 'Mã lỗi ORDER_ALREADY_CANCELLED');

    console.log('\n[10] Hai yêu cầu hủy đồng thời');
    const concurrentOrder = await createOrder(customerA.token, 1, restaurant1);
    const concurrentResults = await Promise.all([
      cancelOrder(customerA.token, concurrentOrder.id, {
        reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'duplicate_order').code,
        expectedStatus: 'pending'
      }),
      cancelOrder(customerA.token, concurrentOrder.id, {
        reason: reasonByCode(CUSTOMER_CANCEL_REASONS, 'duplicate_order').code,
        expectedStatus: 'pending'
      })
    ]);
    const successCount = concurrentResults.filter(result => result.status === 200).length;
    const conflictCount = concurrentResults.filter(result => result.status === 409).length;
    assert(successCount === 1, `Chỉ một yêu cầu thành công (thực tế: ${successCount})`);
    assert(conflictCount === 1, `Yêu cầu còn lại bị từ chối 409 (thực tế: ${conflictCount})`);
    const concurrentReload = await request(`/orders/${concurrentOrder.id}`, { token: customerA.token });
    const concurrentCancelEvents = (concurrentReload.data?.data?.timeline || [])
      .filter(event => event.status === 'cancelled');
    assert(concurrentCancelEvents.length === 1, `Timeline chỉ có một sự kiện hủy (thực tế: ${concurrentCancelEvents.length})`);

    console.log('\n[11] Tải lại dữ liệu sau khi hủy');
    const reloaded = await request(`/orders/${ownOrder.id}`, { token: customerA.token });
    assert(reloaded.status === 200, 'Tải lại đơn hủy thành công');
    assert(reloaded.data?.data?.cancelledBy === 'customer', 'Người hủy vẫn chính xác sau khi tải lại');
    assert(reloaded.data?.data?.cancelReason === 'Đặt nhầm món', 'Lý do vẫn chính xác sau khi tải lại');
    assert(reloaded.data?.data?.cancelNote === 'Tôi chọn nhầm món', 'Ghi chú vẫn chính xác sau khi tải lại');
    assert(Boolean(reloaded.data?.data?.cancelledAt), 'Thời gian hủy vẫn chính xác sau khi tải lại');

    console.log('\n[12] Admin xem lịch sử hủy của khách và quán');
    const pendingForAdmin = await createOrder(customerA.token, 1, restaurant1);
    const directStatusCancel = await updateAdminStatus(admin.token, pendingForAdmin.id, 'cancelled', 'pending');
    assert(directStatusCancel.status === 400, 'Admin không thể cập nhật thẳng status = cancelled');
    assert(directStatusCancel.data?.code === 'CANCEL_REQUIRES_REASON', 'Mã lỗi CANCEL_REQUIRES_REASON');
    const adminCancel = await cancelOrder(admin.token, pendingForAdmin.id, {
      reason: reasonByCode(ADMIN_CANCEL_REASONS, 'customer_request').code,
      note: 'Khách gọi hotline yêu cầu hủy',
      expectedStatus: 'pending'
    });
    assert(adminCancel.status === 200, 'Admin hủy đơn thành công', JSON.stringify(adminCancel.data));
    assert(adminCancel.data?.data?.cancelledBy === 'admin', 'cancelledBy = admin');

    const adminOrders = await request('/orders/admin/all', { token: admin.token });
    assert(adminOrders.status === 200 && Array.isArray(adminOrders.data?.data), 'Admin tải được danh sách đơn');
    const cancelledOrders = (adminOrders.data?.data || []).filter(order => order.id === ownOrder.id || order.id === restaurantOrder.id || order.id === pendingForAdmin.id);
    const actorSet = new Set(cancelledOrders.map(order => order.cancelledBy));
    assert(actorSet.has('customer'), 'Admin thấy đơn do khách hủy');
    assert(actorSet.has('restaurant'), 'Admin thấy đơn do quán hủy');
    assert(actorSet.has('admin'), 'Admin thấy đơn do quản trị viên hủy');
    assert(
      cancelledOrders.every(order => order.cancelReason && order.cancelledAt && order.timeline?.some(event => event.status === 'cancelled')),
      'Mỗi đơn hủy có lý do, thời gian và sự kiện timeline'
    );

    console.log('\n[13] Quán chỉ tải được đơn hàng thuộc quán mình quản lý');
    const restaurantOrders = await request('/orders/restaurant/my', { token: restaurantLogin.token });
    assert(restaurantOrders.status === 200, 'Quán tải được danh sách đơn hàng', JSON.stringify(restaurantOrders.data));
    assert(
      (restaurantOrders.data?.data || []).every(order => Number(order.restaurantId) === 1),
      'Danh sách chỉ chứa đơn thuộc quán được quản lý'
    );
    assert(
      (restaurantOrders.data?.data || []).some(order => order.id === restaurantOrder.id),
      'Danh sách có đơn quán vừa hủy'
    );
    assert(
      !(restaurantOrders.data?.data || []).some(order => order.id === otherRestaurantOrder.id),
      'Không lộ đơn của quán khác'
    );
    assert(
      restaurantOrders.data?.restaurants?.[0]?.id === 1,
      'Danh sách trả kèm thông tin quán đang quản lý'
    );
    const customerRestaurantList = await request('/orders/restaurant/my', { token: customerA.token });
    assert(customerRestaurantList.status === 403, 'Khách hàng không được dùng danh sách đơn của quán');

    console.log('\n[14] Dữ liệu hủy vẫn còn sau khi khởi động lại server');
    await stopServer(server);
    server = startServer(tempDb);
    await waitForServer(server);
    const persisted = await request(`/orders/${ownOrder.id}`, { token: customerA.token });
    assert(persisted.status === 200, 'Server khởi động lại và đọc được đơn');
    assert(persisted.data?.data?.cancelledBy === 'customer', 'Dữ liệu cancelledBy được ghi bền vững');
    assert(persisted.data?.data?.cancelReason === 'Đặt nhầm món', 'Dữ liệu lý do được ghi bền vững');
    assert(Boolean(persisted.data?.data?.cancelledAt), 'Dữ liệu thời gian hủy được ghi bền vững');
  } finally {
    await stopServer(server);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Bỏ qua lỗi dọn file tạm
    }
  }

  console.log('\n========================================================');
  console.log(`KẾT QUẢ: ${passed}/${passed + failed} kiểm tra đạt.`);
  if (failed > 0) {
    console.error(`CÓ ${failed} KIỂM TRA THẤT BẠI.`);
    process.exit(1);
  }
  console.log('TẤT CẢ KIỂM TRA HỦY ĐƠN ĐỀU ĐẠT.');
  console.log('========================================================');
}

run().catch(error => {
  console.error('\nLỖI CHẠY KIỂM THỬ:', error);
  process.exit(1);
});
