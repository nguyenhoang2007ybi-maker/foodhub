// src/orderTracking.js
// FoodHub Visual 7-Stage Order Tracking Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, isLoggedIn } from './auth.js';
import { formatVND } from './cart.js';

let currentOrder = null;
let allOrders = [];

const STAGES = [
  { key: 'pending', label: 'Chờ xác nhận', icon: 'hourglass_top', desc: 'Đơn hàng đang chờ quán nhận' },
  { key: 'confirmed', label: 'Đã xác nhận', icon: 'thumb_up', desc: 'Quán đã tiếp nhận đơn' },
  { key: 'preparing', label: 'Đang chuẩn bị', icon: 'skillet', desc: 'Đầu bếp đang nấu món' },
  { key: 'ready', label: 'Sẵn sàng giao', icon: 'inventory', desc: 'Đóng gói xong, chờ tài xế lấy' },
  { key: 'shipping', label: 'Đang giao hàng', icon: 'two_wheeler', desc: 'Shipper đang trên đường tới bạn' },
  { key: 'completed', label: 'Giao thành công', icon: 'check_circle', desc: 'Bữa ăn đã được giao tới bạn' }
];

const STATUS_BADGE_STYLES = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  preparing: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  ready: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/20',
  shipping: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-700 border-rose-500/20'
};

const STATUS_NAMES = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Đã sẵn sàng giao',
  shipping: 'Đang giao hàng',
  completed: 'Giao thành công',
  cancelled: 'Đã hủy'
};

document.addEventListener('DOMContentLoaded', async () => {
  initHeader();
  initFooter();

  if (!isLoggedIn()) {
    toast.warning('Vui lòng đăng nhập để xem thông tin đơn hàng.');
    setTimeout(() => {
      window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 800);
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  setupViewSwitchers();
  setupCancelModal();

  if (orderId) {
    await loadSingleOrder(orderId);
  } else {
    await loadRecentOrAllOrders();
  }
});

// 1. Tải đơn hàng cụ thể
async function loadSingleOrder(id) {
  try {
    const res = await api.get(`/orders/${id}`);
    if (res && res.success && res.data) {
      currentOrder = res.data;
      renderSingleOrderView(currentOrder);
    } else {
      throw new Error(res.message || 'Không tìm thấy đơn hàng.');
    }
  } catch (err) {
    console.error('Lỗi tải đơn hàng:', err);
    toast.error('Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn này.');
    await loadRecentOrAllOrders();
  }
}

// 2. Tải đơn gần nhất hoặc hiển thị danh sách
async function loadRecentOrAllOrders() {
  try {
    const res = await api.get('/orders/my');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      allOrders = res.data;
      // Mặc định chọn đơn mới nhất
      currentOrder = allOrders[0];
      renderSingleOrderView(currentOrder);
      renderAllOrdersList(allOrders);
    } else {
      document.getElementById('single-order-view')?.classList.add('hidden');
      const allView = document.getElementById('all-orders-view');
      if (allView) {
        allView.classList.remove('hidden');
        document.getElementById('my-orders-list').innerHTML = `
          <div class="py-16 text-center text-secondary">
            <span class="material-symbols-outlined text-5xl mb-2 text-secondary/40">receipt_long</span>
            <p class="font-bold text-on-surface">Bạn chưa có đơn hàng nào.</p>
            <p class="text-xs text-secondary mt-1 mb-6">Hãy đặt món ngon ngay từ các quán ăn trên FoodHub!</p>
            <a href="/explore.html" class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white font-bold text-xs">
              Khám phá món ngon
            </a>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Lỗi tải danh sách đơn:', err);
  }
}

// 3. Render giao diện chi tiết đơn hàng
function renderSingleOrderView(order) {
  document.getElementById('single-order-view')?.classList.remove('hidden');
  document.getElementById('all-orders-view')?.classList.add('hidden');

  // Header
  document.getElementById('order-code-display').textContent = order.code || order.id;
  const statusBadge = document.getElementById('order-status-badge');
  if (statusBadge) {
    statusBadge.textContent = STATUS_NAMES[order.status] || order.status;
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold border ${STATUS_BADGE_STYLES[order.status] || 'bg-surface-container text-on-surface'}`;
  }

  const createdTime = order.createdAt ? new Date(order.createdAt).toLocaleString('vi-VN') : '';
  document.getElementById('order-time-display').textContent = `Khởi tạo lúc: ${createdTime}`;

  // Action Buttons (Hủy đơn hàng)
  const cancelBtn = document.getElementById('open-cancel-modal-btn');
  const cancelNotice = document.getElementById('cancel-blocked-notice');

  // Cho phép hủy khi pending, confirmed hoặc preparing
  const canCancel = ['pending', 'confirmed', 'preparing'].includes(order.status);
  if (canCancel) {
    cancelBtn?.classList.remove('hidden');
    cancelNotice?.classList.add('hidden');
  } else {
    cancelBtn?.classList.add('hidden');
    if (order.status === 'cancelled') {
      cancelNotice?.classList.remove('hidden');
      cancelNotice.textContent = `Đơn hàng đã bị hủy bởi ${order.cancelledBy || 'Người dùng'}. Lý do: ${order.cancelReason || 'Không có'}`;
      cancelNotice.className = 'text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl block';
    } else if (['ready', 'shipping'].includes(order.status)) {
      cancelNotice?.classList.remove('hidden');
      cancelNotice.textContent = 'Món ăn đã sẵn sàng giao hoặc đang trên đường giao, không thể hủy đơn.';
      cancelNotice.className = 'text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl block';
    } else if (order.status === 'completed') {
      cancelNotice?.classList.remove('hidden');
      cancelNotice.textContent = 'Đơn hàng đã được giao thành công.';
      cancelNotice.className = 'text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl block';
    } else {
      cancelNotice?.classList.add('hidden');
    }
  }

  // Render 7-stage visual progress stepper
  renderVisualStepper(order);

  // Render Items List
  const itemsContainer = document.getElementById('order-items-table');
  const itemsCountBadge = document.getElementById('order-items-count-badge');
  if (itemsContainer && Array.isArray(order.items)) {
    itemsContainer.innerHTML = '';
    order.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'py-3 flex items-center justify-between gap-3 text-xs';
      row.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" alt="${item.name}" class="w-12 h-12 rounded-xl object-cover ring-1 ring-surface-container flex-shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-on-surface truncate">${item.name}</h4>
            <p class="text-[11px] text-secondary mt-0.5">Số lượng: <strong class="text-on-surface">${item.quantity}</strong> × ${formatVND(item.priceNum || item.price)}</p>
          </div>
        </div>
        <span class="font-bold text-on-surface flex-shrink-0">${formatVND(item.total || (item.priceNum * item.quantity))}</span>
      `;
      itemsContainer.appendChild(row);
    });

    if (itemsCountBadge) {
      itemsCountBadge.textContent = `${order.items.reduce((s, i) => s + (i.quantity || 1), 0)} món`;
    }
  }

  // Pricing
  document.getElementById('order-subtotal').textContent = formatVND(order.subtotal || 0);
  document.getElementById('order-shipping').textContent = (order.shippingFee === 0) ? 'Miễn phí' : formatVND(order.shippingFee || 0);

  const discountRow = document.getElementById('order-discount-row');
  const discountEl = document.getElementById('order-discount');
  const couponCodeEl = document.getElementById('order-coupon-code');
  if (order.discount && Number(order.discount) > 0) {
    discountRow?.classList.remove('hidden');
    if (discountEl) discountEl.textContent = `-${formatVND(order.discount)}`;
    if (couponCodeEl) couponCodeEl.textContent = order.couponCode || 'Ưu đãi';
  } else {
    discountRow?.classList.add('hidden');
  }

  document.getElementById('order-total').textContent = formatVND(order.total || 0);

  // Timeline
  const timelineContainer = document.getElementById('order-timeline-list');
  if (timelineContainer) {
    timelineContainer.innerHTML = '';
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    [...timeline].reverse().forEach((event, idx) => {
      const item = document.createElement('div');
      item.className = 'flex items-start gap-3 relative text-xs';
      const timeStr = event.time ? new Date(event.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
      const isLatest = idx === 0;

      item.innerHTML = `
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white ${isLatest ? 'bg-primary ring-4 ring-primary/20' : 'bg-secondary/40'}">
          <span class="material-symbols-outlined text-[16px]">${isLatest ? 'fiber_manual_record' : 'check'}</span>
        </div>
        <div class="flex-1 pb-3 ${idx < timeline.length - 1 ? 'border-b border-surface-container-high' : ''}">
          <div class="flex items-center justify-between">
            <span class="font-bold text-on-surface">${event.message || STATUS_NAMES[event.status] || event.status}</span>
            <span class="text-[11px] text-secondary">${timeStr}</span>
          </div>
        </div>
      `;
      timelineContainer.appendChild(item);
    });
  }

  // Restaurant details
  const restImg = document.getElementById('order-rest-img');
  const restName = document.getElementById('order-rest-name');
  const restAddr = document.getElementById('order-rest-addr');
  const restLink = document.getElementById('order-rest-link');

  if (restImg) restImg.src = order.restaurantImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80';
  if (restName) restName.textContent = order.restaurantName || 'Quán ăn';
  if (restAddr) restAddr.textContent = order.restaurantAddress || '';
  if (restLink && order.restaurantId) restLink.href = `/restaurant-detail.html?id=${order.restaurantId}`;

  // Recipient details
  document.getElementById('order-recipient-name').textContent = order.recipientName || 'Khách hàng';
  document.getElementById('order-recipient-phone').textContent = order.recipientPhone || 'Chưa cập nhật';
  document.getElementById('order-delivery-address').textContent = order.deliveryAddress || 'Chưa có địa chỉ';

  const noteBox = document.getElementById('order-note-container');
  const noteText = document.getElementById('order-note-text');
  if (order.note) {
    noteBox?.classList.remove('hidden');
    if (noteText) noteText.textContent = `"${order.note}"`;
  } else {
    noteBox?.classList.add('hidden');
  }

  // Payment
  const isBankTransfer = order.paymentMethod === 'BANK_TRANSFER';
  document.getElementById('order-payment-method').textContent = isBankTransfer ? 'Chuyển khoản (VietQR)' : 'Tiền mặt khi nhận (COD)';

  const paymentStatusBadge = document.getElementById('order-payment-status');
  if (paymentStatusBadge) {
    if (order.paymentStatus === 'paid') {
      paymentStatusBadge.textContent = 'Đã thanh toán';
      paymentStatusBadge.className = 'px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-emerald-500/10 text-emerald-700';
    } else if (order.paymentStatus === 'refunded') {
      paymentStatusBadge.textContent = 'Đã hoàn tiền';
      paymentStatusBadge.className = 'px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-purple-500/10 text-purple-700';
    } else {
      paymentStatusBadge.textContent = 'Chưa thanh toán';
      paymentStatusBadge.className = 'px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-500/10 text-amber-700';
    }
  }

  // Bank Transfer Guidance Box
  const bankBox = document.getElementById('order-bank-transfer-box');
  const syntaxEl = document.getElementById('bank-transfer-syntax');
  if (isBankTransfer && order.paymentStatus !== 'paid' && order.status !== 'cancelled') {
    bankBox?.classList.remove('hidden');
    if (syntaxEl) syntaxEl.textContent = order.code || order.id;
  } else {
    bankBox?.classList.add('hidden');
  }
}

// 4. Render visual 7-stage progress stepper
function renderVisualStepper(order) {
  const container = document.getElementById('stepper-container');
  if (!container) return;

  if (order.status === 'cancelled') {
    container.innerHTML = `
      <div class="p-6 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <div class="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
          <span class="material-symbols-outlined text-[32px]">cancel</span>
        </div>
        <div class="flex-1">
          <h3 class="text-base font-bold text-rose-900">Đơn hàng này đã bị hủy</h3>
          <p class="text-xs text-rose-700 mt-1">
            Người hủy: <strong>${order.cancelledBy || 'Người dùng'}</strong> • Lý do: <em>"${order.cancelReason || 'Không có lý do cụ thể'}"</em>
          </p>
          <p class="text-[11px] text-rose-600 mt-1">
            Mã giảm giá đã sử dụng (nếu có) đã được hoàn trả lại cho tài khoản của bạn.
          </p>
        </div>
      </div>
    `;
    return;
  }

  const currentIdx = STAGES.findIndex(s => s.key === order.status);
  const activeIndex = currentIdx >= 0 ? currentIdx : 0;

  // Desktop horizontal stepper
  let stepsHtml = `
    <div class="hidden md:grid grid-cols-6 gap-2 relative">
      <!-- Background Connecting Line -->
      <div class="absolute top-5 left-10 right-10 h-1 bg-surface-container-high -z-0"></div>
      <div class="absolute top-5 left-10 h-1 bg-primary -z-0 transition-all duration-500" style="width: ${(activeIndex / (STAGES.length - 1)) * 100}%;"></div>
  `;

  STAGES.forEach((stage, idx) => {
    const isCompleted = idx < activeIndex;
    const isCurrent = idx === activeIndex;

    let iconBg = 'bg-surface-container-high text-secondary';
    if (isCompleted) iconBg = 'bg-primary text-white shadow-sm';
    if (isCurrent) iconBg = 'bg-primary text-white ring-4 ring-primary/25 shadow-md animate-pulse';

    stepsHtml += `
      <div class="flex flex-col items-center text-center relative z-10 px-1">
        <div class="w-10 h-10 rounded-full ${iconBg} flex items-center justify-center font-bold text-xs transition-all duration-300">
          <span class="material-symbols-outlined text-[20px]">${isCompleted ? 'check' : stage.icon}</span>
        </div>
        <span class="text-xs font-bold mt-2.5 ${isCurrent ? 'text-primary' : (isCompleted ? 'text-on-surface' : 'text-secondary/60')}">${stage.label}</span>
        <span class="text-[10px] text-secondary mt-0.5 leading-tight">${stage.desc}</span>
      </div>
    `;
  });

  stepsHtml += `</div>`;

  // Mobile vertical stepper
  let mobileHtml = `<div class="md:hidden space-y-3 relative pl-6 border-l-2 border-primary/20">`;
  STAGES.forEach((stage, idx) => {
    const isCompleted = idx < activeIndex;
    const isCurrent = idx === activeIndex;

    let dotClass = 'bg-surface-container-high text-secondary border-surface-container';
    if (isCompleted) dotClass = 'bg-primary text-white border-primary';
    if (isCurrent) dotClass = 'bg-primary text-white ring-4 ring-primary/25 border-primary animate-pulse';

    mobileHtml += `
      <div class="relative pb-3 ${idx < STAGES.length - 1 ? 'border-b border-surface-container-high/60' : ''}">
        <div class="absolute -left-[31px] top-0 w-6 h-6 rounded-full ${dotClass} border flex items-center justify-center text-[12px]">
          <span class="material-symbols-outlined text-[14px]">${isCompleted ? 'check' : stage.icon}</span>
        </div>
        <div>
          <h4 class="text-xs font-bold ${isCurrent ? 'text-primary' : (isCompleted ? 'text-on-surface' : 'text-secondary')}">${stage.label}</h4>
          <p class="text-[11px] text-secondary mt-0.5">${stage.desc}</p>
        </div>
      </div>
    `;
  });
  mobileHtml += `</div>`;

  container.innerHTML = stepsHtml + mobileHtml;
}

// 5. Quản lý danh sách tất cả đơn hàng
function renderAllOrdersList(orders) {
  const container = document.getElementById('my-orders-list');
  const countEl = document.getElementById('my-orders-count');
  if (countEl) countEl.textContent = orders.length;
  if (!container) return;

  container.innerHTML = '';
  orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'p-5 rounded-3xl bg-surface-container-lowest border border-surface-container-high hover:border-primary/40 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4';

    const itemsSummary = (order.items || []).map(i => `${i.name} (${i.quantity})`).join(', ');

    card.innerHTML = `
      <div class="flex items-start gap-4">
        <img src="${order.restaurantImage || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=150&q=80'}" alt="${order.restaurantName}" class="w-14 h-14 rounded-2xl object-cover ring-1 ring-surface-container-high flex-shrink-0" />
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs font-bold text-primary">${order.code || order.id}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE_STYLES[order.status] || ''}">
              ${STATUS_NAMES[order.status] || order.status}
            </span>
          </div>
          <h4 class="text-sm font-bold text-on-surface truncate">${order.restaurantName}</h4>
          <p class="text-xs text-secondary truncate max-w-md">${itemsSummary}</p>
          <p class="text-[11px] text-secondary">Đặt lúc: ${new Date(order.createdAt).toLocaleString('vi-VN')}</p>
        </div>
      </div>

      <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-surface-container-high">
        <span class="text-base font-black text-primary">${formatVND(order.total || 0)}</span>
        <button type="button" class="view-detail-btn h-9 px-4 rounded-xl bg-surface-container-low hover:bg-primary hover:text-white text-xs font-bold text-on-surface transition-all cursor-pointer" data-id="${order.code || order.id}">
          Chi tiết đơn
        </button>
      </div>
    `;

    card.querySelector('.view-detail-btn')?.addEventListener('click', () => {
      currentOrder = order;
      renderSingleOrderView(order);
      window.history.pushState({}, '', `/order-tracking.html?id=${order.code || order.id}`);
    });

    container.appendChild(card);
  });
}

// 6. View Switcher
function setupViewSwitchers() {
  const viewAllBtn = document.getElementById('view-all-orders-btn');
  const backBtn = document.getElementById('back-to-active-order-btn');

  viewAllBtn?.addEventListener('click', async () => {
    document.getElementById('single-order-view')?.classList.add('hidden');
    document.getElementById('all-orders-view')?.classList.remove('hidden');
    if (allOrders.length === 0) {
      await loadRecentOrAllOrders();
    } else {
      renderAllOrdersList(allOrders);
    }
  });

  backBtn?.addEventListener('click', () => {
    if (currentOrder) {
      renderSingleOrderView(currentOrder);
    }
  });
}

// 7. Modal hủy đơn hàng
function setupCancelModal() {
  const modal = document.getElementById('cancel-order-modal');
  const openBtn = document.getElementById('open-cancel-modal-btn');
  const closeBtn = document.getElementById('close-cancel-modal-btn');
  const form = document.getElementById('cancel-order-form');
  const presetSelect = document.getElementById('cancel-reason-preset');
  const customTextarea = document.getElementById('cancel-reason-custom');

  const openModal = () => modal?.classList.remove('hidden');
  const closeModal = () => modal?.classList.add('hidden');

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);

  presetSelect?.addEventListener('change', () => {
    if (presetSelect.value === 'other') {
      customTextarea?.classList.remove('hidden');
      customTextarea?.focus();
    } else {
      customTextarea?.classList.add('hidden');
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOrder) return;

    let reason = presetSelect?.value;
    if (reason === 'other') {
      reason = customTextarea?.value.trim();
    }

    if (!reason || reason.length < 3) {
      toast.warning('Vui lòng nhập lý do hủy đơn (tối thiểu 3 ký tự).');
      return;
    }

    try {
      const res = await api.patch(`/orders/${currentOrder.code || currentOrder.id}/cancel`, { reason });
      if (res && res.success && res.data) {
        toast.success('Hủy đơn hàng thành công! Mã giảm giá (nếu có) đã được hoàn trả.');
        closeModal();
        currentOrder = res.data;
        renderSingleOrderView(currentOrder);
      } else {
        throw new Error(res.message || 'Không thể hủy đơn hàng.');
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hủy đơn hàng.');
    }
  });
}

