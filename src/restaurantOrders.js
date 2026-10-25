import { api } from './api.js';
import { initHeader, initFooter, getUser, isLoggedIn } from './auth.js';
import { toast } from './toast.js';
import { getOrderStatusLabel } from '../shared/orderStatus.js';
import {
  getCancelReasonOptions,
  canActorCancelOrderStatus,
  getOrderCancellation
} from '../shared/orderCancellation.js';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 border-sky-200',
  preparing: 'bg-violet-100 text-violet-800 border-violet-200',
  shipping: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-rose-100 text-rose-800 border-rose-200'
};

let currentOrders = [];
let currentOrder = null;
let isLoading = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatDate(value) {
  if (!value) return 'Không xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không xác định';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function showAlert(message) {
  const alertEl = document.getElementById('restaurant-alert');
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.classList.remove('hidden');
}

function hideAlert() {
  document.getElementById('restaurant-alert')?.classList.add('hidden');
}

function setLoading(loading) {
  isLoading = loading;
  document.getElementById('restaurant-loading')?.classList.toggle('hidden', !loading);
  const refreshBtn = document.getElementById('restaurant-refresh-btn');
  if (refreshBtn) refreshBtn.disabled = loading;
}

function renderSummary(orders) {
  const summaryEl = document.getElementById('restaurant-summary');
  if (!summaryEl) return;

  const counts = {
    total: orders.length,
    waiting: orders.filter(order => ['pending', 'confirmed'].includes(order.status)).length,
    completed: orders.filter(order => order.status === 'completed').length,
    cancelled: orders.filter(order => order.status === 'cancelled').length
  };

  const cards = [
    { label: 'Tổng đơn hàng', value: counts.total, icon: 'receipt_long', color: 'text-primary bg-primary-container/10' },
    { label: 'Chờ xử lý', value: counts.waiting, icon: 'pending_actions', color: 'text-amber-700 bg-amber-100' },
    { label: 'Hoàn tất', value: counts.completed, icon: 'task_alt', color: 'text-emerald-700 bg-emerald-100' },
    { label: 'Đã hủy', value: counts.cancelled, icon: 'cancel', color: 'text-rose-700 bg-rose-100' }
  ];

  summaryEl.innerHTML = cards.map(card => `
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl ${card.color} flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined text-[21px]">${card.icon}</span>
      </div>
      <div>
        <p class="text-[11px] font-semibold text-secondary">${card.label}</p>
        <p class="text-xl font-black text-on-surface">${card.value}</p>
      </div>
    </div>
  `).join('');
  summaryEl.classList.remove('hidden');
  summaryEl.classList.add('grid');
}

function renderItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    return '<p class="text-xs text-secondary">Không có thông tin món ăn.</p>';
  }

  return items.map(item => `
    <div class="flex items-center justify-between gap-3 py-2 border-b border-surface-container last:border-b-0">
      <div class="min-w-0">
        <p class="text-xs font-bold text-on-surface truncate">${escapeHtml(item.name || 'Món ăn')}</p>
        <p class="text-[11px] text-secondary">${formatCurrency(item.price)} × ${Number(item.quantity || 1)}</p>
      </div>
      <p class="text-xs font-bold text-on-surface whitespace-nowrap">${formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}</p>
    </div>
  `).join('');
}

function renderCancellation(order) {
  const cancellation = getOrderCancellation(order);
  if (!cancellation) return '';

  return `
    <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5">
      <div class="flex items-center gap-1.5 text-rose-700">
        <span class="material-symbols-outlined text-[17px]">cancel</span>
        <p class="text-xs font-black uppercase tracking-wide">Thông tin hủy đơn</p>
      </div>
      <div class="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <p><span class="text-secondary">Người hủy:</span> <span class="font-bold text-on-surface">${escapeHtml(cancellation.byName || cancellation.actorLabel)}</span></p>
        <p><span class="text-secondary">Thời gian:</span> <span class="font-semibold text-on-surface">${formatDate(cancellation.at)}</span></p>
        <p class="sm:col-span-2"><span class="text-secondary">Lý do:</span> <span class="font-bold text-on-surface">${escapeHtml(cancellation.reason || 'Không có lý do được ghi lại')}</span></p>
        ${cancellation.note ? `<p class="sm:col-span-2"><span class="text-secondary">Ghi chú:</span> <span class="font-semibold text-on-surface">${escapeHtml(cancellation.note)}</span></p>` : ''}
      </div>
    </div>
  `;
}

function renderOrderCard(order) {
  const status = order.status || 'pending';
  const statusClass = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const canCancel = canActorCancelOrderStatus(status);

  return `
    <article class="bg-surface-container-lowest border border-surface-container-high rounded-3xl p-4 sm:p-5 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-surface-container">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-black text-primary font-mono text-sm">${escapeHtml(order.code || order.id)}</p>
            <span class="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold ${statusClass}">${escapeHtml(getOrderStatusLabel(status))}</span>
          </div>
          <p class="text-[11px] text-secondary mt-1">Đặt lúc ${formatDate(order.createdAt)}</p>
        </div>
        ${canCancel ? `
          <button type="button" data-order-cancel="${escapeHtml(order.id)}" class="self-start inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors">
            <span class="material-symbols-outlined text-[17px]">cancel</span>
            <span>Hủy đơn</span>
          </button>
        ` : ''}
      </div>

      <div class="grid md:grid-cols-2 gap-5 pt-4">
        <div>
          <p class="text-[11px] font-black uppercase tracking-wider text-secondary mb-2">Khách hàng & giao hàng</p>
          <p class="text-sm font-bold text-on-surface">${escapeHtml(order.recipientName || order.userName || 'Khách hàng')}</p>
          <p class="text-xs text-secondary mt-0.5">${escapeHtml(order.recipientPhone || 'Chưa có số điện thoại')}</p>
          <p class="text-xs text-on-surface mt-2 leading-relaxed">${escapeHtml(order.deliveryAddress || 'Chưa có địa chỉ giao hàng')}</p>
          ${order.note ? `<p class="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2"><span class="font-bold">Ghi chú khách:</span> ${escapeHtml(order.note)}</p>` : ''}
        </div>

        <div>
          <p class="text-[11px] font-black uppercase tracking-wider text-secondary mb-2">Món ăn & thanh toán</p>
          <div class="rounded-2xl bg-surface-container-low px-3 py-1">
            ${renderItems(order)}
          </div>
          <div class="mt-2 space-y-1 text-xs">
            <div class="flex justify-between text-secondary"><span>Tạm tính</span><span>${formatCurrency(order.subtotal)}</span></div>
            <div class="flex justify-between text-secondary"><span>Phí giao hàng</span><span>${formatCurrency(order.shippingFee)}</span></div>
            ${Number(order.discount || 0) > 0 ? `<div class="flex justify-between text-emerald-700"><span>Giảm giá</span><span>-${formatCurrency(order.discount)}</span></div>` : ''}
            <div class="flex justify-between items-center pt-2 border-t border-surface-container">
              <span class="font-bold text-on-surface">Tổng cộng</span>
              <span class="text-base font-black text-primary">${formatCurrency(order.total)}</span>
            </div>
            <p class="text-[11px] text-secondary text-right">Thanh toán: ${escapeHtml(order.paymentMethod === 'COD' ? 'Khi nhận hàng (COD)' : order.paymentMethod || 'COD')}</p>
          </div>
        </div>
      </div>

      ${renderCancellation(order)}
    </article>
  `;
}

function renderOrders(orders) {
  const listEl = document.getElementById('restaurant-orders');
  const emptyEl = document.getElementById('restaurant-empty');
  if (!listEl || !emptyEl) return;

  if (orders.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    listEl.innerHTML = orders.map(renderOrderCard).join('');
  }

  listEl.querySelectorAll('[data-order-cancel]').forEach(button => {
    button.addEventListener('click', () => {
      const order = currentOrders.find(item => String(item.id) === String(button.dataset.orderCancel));
      if (order) openCancelModal(order);
    });
  });
}

function updateSubtitle(restaurants) {
  const subtitleEl = document.getElementById('restaurant-page-subtitle');
  if (!subtitleEl) return;

  if (!restaurants || restaurants.length === 0) {
    subtitleEl.textContent = 'Tài khoản chưa được gán quán ăn nào.';
    return;
  }

  subtitleEl.textContent = restaurants.length === 1
    ? `Đang quản lý: ${restaurants[0].name}`
    : `Đang quản lý ${restaurants.length} quán: ${restaurants.map(item => item.name).join(', ')}`;
}

async function loadOrders() {
  if (isLoading) return;
  setLoading(true);
  hideAlert();

  try {
    const res = await api.get('/orders/restaurant/my');
    currentOrders = Array.isArray(res.data) ? res.data : [];
    updateSubtitle(res.restaurants || []);
    renderSummary(currentOrders);
    renderOrders(currentOrders);
  } catch (error) {
    console.error('Lỗi tải đơn hàng của quán:', error);
    currentOrders = [];
    renderOrders([]);
    document.getElementById('restaurant-summary')?.classList.add('hidden');
    showAlert(error.message || 'Không thể tải danh sách đơn hàng của quán.');
  } finally {
    setLoading(false);
  }
}

function populateCancelReasons() {
  const select = document.getElementById('restaurant-cancel-reason');
  if (!select) return;
  const options = getCancelReasonOptions('restaurant');
  options.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option.code;
    optionEl.textContent = option.label;
    select.appendChild(optionEl);
  });
}

function updateNoteRequirement() {
  const select = document.getElementById('restaurant-cancel-reason');
  const note = document.getElementById('restaurant-cancel-note');
  const hint = document.getElementById('restaurant-cancel-note-hint');
  if (!select || !note || !hint) return;

  const option = getCancelReasonOptions('restaurant').find(item => item.code === select.value);
  const required = Boolean(option?.requiresNote);
  note.required = required;
  note.placeholder = required
    ? 'Vui lòng mô tả rõ lý do (tối thiểu 3 ký tự)...'
    : 'Thông tin thêm cho khách hàng hoặc bộ phận hỗ trợ...';
  hint.textContent = required ? '(bắt buộc)' : '(nếu có)';
  hint.className = required ? 'font-bold text-rose-600' : 'font-medium text-secondary';
}

function showCancelError(message) {
  const errorEl = document.getElementById('restaurant-cancel-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideCancelError() {
  document.getElementById('restaurant-cancel-error')?.classList.add('hidden');
}

function openCancelModal(order) {
  currentOrder = order;
  const modal = document.getElementById('restaurant-cancel-modal');
  const codeEl = document.getElementById('restaurant-cancel-code');
  const select = document.getElementById('restaurant-cancel-reason');
  const note = document.getElementById('restaurant-cancel-note');
  if (!modal) return;

  if (codeEl) codeEl.textContent = order.code || order.id;
  if (select) select.value = '';
  if (note) note.value = '';
  hideCancelError();
  updateNoteRequirement();
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  setTimeout(() => select?.focus(), 50);
}

function closeCancelModal() {
  document.getElementById('restaurant-cancel-modal')?.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  currentOrder = null;
  hideCancelError();
}

async function submitCancellation(event) {
  event.preventDefault();
  if (!currentOrder) return;

  hideCancelError();
  const select = document.getElementById('restaurant-cancel-reason');
  const note = document.getElementById('restaurant-cancel-note');
  const submitBtn = document.getElementById('restaurant-cancel-submit');

  if (!select?.value) {
    showCancelError('Vui lòng chọn lý do hủy đơn.');
    select?.focus();
    return;
  }

  const selectedOption = getCancelReasonOptions('restaurant').find(item => item.code === select.value);
  if (selectedOption?.requiresNote && (note?.value || '').trim().length < 3) {
    showCancelError('Vui lòng nhập ghi chú chi tiết cho lý do "Lý do khác" (tối thiểu 3 ký tự).');
    note?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang hủy đơn...';
  }

  try {
    const res = await api.patch(`/orders/${encodeURIComponent(currentOrder.id)}/cancel`, {
      reason: select.value,
      note: (note?.value || '').trim(),
      expectedStatus: currentOrder.status
    });
    toast.success(res.message || 'Đã hủy đơn hàng thành công.');
    closeCancelModal();
    await loadOrders();
  } catch (error) {
    showCancelError(error.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.');
    if (error.status === 409) {
      await loadOrders();
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Xác nhận hủy';
    }
  }
}

function guardAccess() {
  if (!isLoggedIn()) {
    window.location.href = `/login.html?returnUrl=${encodeURIComponent('/restaurant.html')}`;
    return false;
  }

  const user = getUser();
  if (!['restaurant', 'restaurant_owner', 'restaurant_manager'].includes(user?.role)) {
    toast.error('Trang này chỉ dành cho tài khoản chủ quán.');
    setTimeout(() => {
      window.location.href = user?.role === 'admin' ? '/admin.html' : '/index.html';
    }, 700);
    return false;
  }

  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!guardAccess()) return;

  initHeader('restaurant');
  initFooter();
  populateCancelReasons();
  updateNoteRequirement();

  document.getElementById('restaurant-refresh-btn')?.addEventListener('click', loadOrders);
  document.getElementById('restaurant-cancel-form')?.addEventListener('submit', submitCancellation);
  document.getElementById('restaurant-cancel-reason')?.addEventListener('change', updateNoteRequirement);
  document.querySelectorAll('[data-restaurant-cancel-close]').forEach(element => {
    element.addEventListener('click', closeCancelModal);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCancelModal();
  });

  loadOrders();
});
