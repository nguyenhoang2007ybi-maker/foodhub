// FoodHub Cart & Checkout & Order History Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, getUser, isLoggedIn } from './auth.js';
import {
  getCart,
  saveCart,
  updateQuantity,
  removeItem,
  clearCart,
  getCartCount,
  getCartSubtotal,
  formatVND,
  updateCartBadge
} from './cart.js';

let appliedCoupon = null;
let isSubmitting = false;
let pendingCancelOrderId = null;

const COUPONS = {
  FOODHUB10: { code: 'FOODHUB10', type: 'percent', value: 10, max: 50000, description: 'Giảm 10% tối đa 50k' },
  FREESHIP: { code: 'FREESHIP', type: 'freeship', description: 'Miễn phí giao hàng 15k' },
  BANMOI: { code: 'BANMOI', type: 'fixed', value: 20000, minOrder: 50000, description: 'Giảm 20k cho đơn từ 50k' }
};

const STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-800 border-amber-300', icon: 'schedule' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-sky-100 text-sky-800 border-sky-300', icon: 'thumb_up' },
  preparing: { label: 'Đang nấu món', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: 'skillet' },
  shipping: { label: 'Đang giao hàng', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: 'delivery_dining' },
  completed: { label: 'Giao thành công', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'check_circle' },
  cancelled: { label: 'Đã hủy', color: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'cancel' }
};

document.addEventListener('DOMContentLoaded', () => {
  initHeader('cart');
  initFooter();

  setupTabs();
  setupCartView();
  setupCheckoutForm();
  setupModals();

  // Kiểm tra tab từ URL (#orders hoặc ?tab=orders)
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  if (urlParams.get('tab') === 'orders' || hash === '#orders') {
    switchTab('orders');
  } else {
    switchTab('cart');
  }

  // Lắng nghe sự kiện giỏ hàng được cập nhật từ component khác
  window.addEventListener('foodhub:cart-updated', () => {
    renderCart();
  });
});

// 1. Quản lý chuyển tab Giỏ hàng vs Lịch sử đơn
function setupTabs() {
  const btnCart = document.getElementById('tab-btn-cart');
  const btnOrders = document.getElementById('tab-btn-orders');

  btnCart?.addEventListener('click', () => switchTab('cart'));
  btnOrders?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/order-tracking.html';
  });

  document.getElementById('refresh-orders-btn')?.addEventListener('click', () => {
    loadMyOrders();
    toast.info('Đã làm mới danh sách đơn hàng.');
  });
}

function switchTab(tab) {
  const btnCart = document.getElementById('tab-btn-cart');
  const btnOrders = document.getElementById('tab-btn-orders');
  const cartView = document.getElementById('cart-view');
  const ordersView = document.getElementById('orders-view');

  if (tab === 'orders') {
    btnOrders.className = 'tab-btn pb-2 text-sm sm:text-base font-bold text-primary border-b-2 border-primary flex items-center gap-2 cursor-pointer transition-colors';
    btnCart.className = 'tab-btn pb-2 text-sm sm:text-base font-bold text-secondary hover:text-on-surface border-b-2 border-transparent flex items-center gap-2 cursor-pointer transition-colors';
    cartView.classList.add('hidden');
    ordersView.classList.remove('hidden');
    loadMyOrders();
  } else {
    btnCart.className = 'tab-btn pb-2 text-sm sm:text-base font-bold text-primary border-b-2 border-primary flex items-center gap-2 cursor-pointer transition-colors';
    btnOrders.className = 'tab-btn pb-2 text-sm sm:text-base font-bold text-secondary hover:text-on-surface border-b-2 border-transparent flex items-center gap-2 cursor-pointer transition-colors';
    cartView.classList.remove('hidden');
    ordersView.classList.add('hidden');
    renderCart();
  }
}

// 2. Render và thao tác trên giỏ hàng
function setupCartView() {
  // Clear cart button
  document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('clear-cart-modal');
    modal?.classList.remove('hidden');
  });

  document.getElementById('cancel-clear-btn')?.addEventListener('click', () => {
    document.getElementById('clear-cart-modal')?.classList.add('hidden');
  });

  document.getElementById('confirm-clear-btn')?.addEventListener('click', async () => {
    await clearCart();
    document.getElementById('clear-cart-modal')?.classList.add('hidden');
    appliedCoupon = null;
    toast.info('Đã làm trống giỏ hàng.');
    renderCart();
  });

  // Coupon handling
  const couponInput = document.getElementById('coupon-input');
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const removeCouponBtn = document.getElementById('remove-coupon-btn');

  applyCouponBtn?.addEventListener('click', () => {
    const code = (couponInput.value || '').trim().toUpperCase();
    applyCouponCode(code);
  });

  removeCouponBtn?.addEventListener('click', () => {
    appliedCoupon = null;
    if (couponInput) couponInput.value = '';
    document.getElementById('applied-coupon-badge')?.classList.add('hidden');
    toast.info('Đã gỡ mã ưu đãi.');
    renderSummary();
  });

  // Proceed to Checkout button
  document.getElementById('proceed-to-checkout-btn')?.addEventListener('click', (e) => {
    const cart = getCart();
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      e.preventDefault();
      toast.warning('Giỏ hàng của bạn đang trống.');
      return;
    }
    if (!isLoggedIn()) {
      e.preventDefault();
      toast.warning('Vui lòng đăng nhập để tiến hành đặt hàng.');
      setTimeout(() => {
        window.location.href = `/login.html?returnUrl=%2Fcheckout.html`;
      }, 800);
    }
  });

  // Fast coupon pills
  document.querySelectorAll('.coupon-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const code = pill.dataset.code;
      if (couponInput) couponInput.value = code;
      applyCouponCode(code);
    });
  });
}

function applyCouponCode(code) {
  if (!code) {
    toast.warning('Vui lòng nhập mã ưu đãi.');
    return;
  }

  const coupon = COUPONS[code];
  if (!coupon) {
    toast.error('Mã giảm giá không tồn tại hoặc đã hết hạn.');
    return;
  }

  const subtotal = getCartSubtotal();
  if (coupon.type === 'fixed' && coupon.minOrder && subtotal < coupon.minOrder) {
    toast.warning(`Mã ${code} chỉ áp dụng cho đơn hàng từ ${formatVND(coupon.minOrder)}.`);
    return;
  }

  appliedCoupon = coupon;
  const badge = document.getElementById('applied-coupon-badge');
  const badgeText = document.getElementById('applied-coupon-text');
  if (badge && badgeText) {
    badgeText.textContent = `Đã áp dụng mã: ${coupon.code} (${coupon.description})`;
    badge.classList.remove('hidden');
  }

  toast.success(`Áp dụng thành công mã ưu đãi "${coupon.code}"!`);
  renderSummary();
}

function renderCart() {
  const cart = getCart();
  const emptyState = document.getElementById('cart-empty-state');
  const contentState = document.getElementById('cart-content-state');
  const tabBadge = document.getElementById('tab-cart-badge');

  const count = getCartCount();
  if (tabBadge) tabBadge.textContent = count;
  updateCartBadge();

  if (cart.items.length === 0) {
    emptyState?.classList.remove('hidden');
    contentState?.classList.add('hidden');
    return;
  }

  emptyState?.classList.add('hidden');
  contentState?.classList.remove('hidden');

  // Restaurant details
  const restNameEl = document.getElementById('cart-rest-name');
  const restAddrEl = document.getElementById('cart-rest-address');
  const restLinkEl = document.getElementById('cart-rest-link');
  const backToMenuEl = document.getElementById('cart-back-to-menu');

  if (restNameEl) restNameEl.textContent = cart.restaurantName || 'Quán ăn';
  if (restAddrEl) restAddrEl.textContent = cart.restaurantAddress || 'Địa chỉ đang cập nhật';
  
  const restUrl = cart.restaurantId ? `/restaurant-detail.html?id=${cart.restaurantId}` : '/explore.html';
  if (restLinkEl) restLinkEl.href = restUrl;
  if (backToMenuEl) backToMenuEl.href = restUrl;

  // Render items list
  const listEl = document.getElementById('cart-items-list');
  const countEl = document.getElementById('cart-items-count');
  if (countEl) countEl.textContent = count;

  if (listEl) {
    listEl.innerHTML = '';
    cart.items.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4';
      
      const priceUnit = item.priceNum || (parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10) || 0);
      const itemTotal = priceUnit * item.quantity;

      itemEl.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-14 h-14 rounded-2xl overflow-hidden bg-surface-container-high flex-shrink-0">
            <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}" alt="${item.name}" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <h4 class="text-sm font-bold text-on-surface truncate">${item.name}</h4>
            <p class="text-xs font-semibold text-primary mt-0.5">${formatVND(priceUnit)} / suất</p>
            <input
              type="text"
              placeholder="Ghi chú món (ví dụ: không hành)..."
              value="${item.note || ''}"
              class="item-note-input mt-1.5 w-full max-w-xs h-7 px-2.5 rounded-lg bg-surface-container-low border border-surface-container-high text-[11px] text-on-surface focus:outline-none focus:border-primary-container"
              data-dish-id="${item.dishId}"
            />
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
          <!-- Quantity Controls -->
          <div class="flex items-center border border-surface-container-high rounded-xl bg-surface-container-low overflow-hidden">
            <button type="button" class="qty-btn-minus w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer" data-dish-id="${item.dishId}">
              <span class="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <span class="w-8 text-center text-xs font-bold text-on-surface">${item.quantity}</span>
            <button type="button" class="qty-btn-plus w-8 h-8 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer" data-dish-id="${item.dishId}">
              <span class="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>

          <!-- Total for item -->
          <div class="text-right min-w-[80px]">
            <span class="text-xs font-bold text-on-surface">${formatVND(itemTotal)}</span>
          </div>

          <!-- Remove Button -->
          <button type="button" class="item-remove-btn p-1.5 rounded-lg text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" data-dish-id="${item.dishId}" title="Xóa món">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      `;

      // Event listeners for item
      itemEl.querySelector('.qty-btn-minus')?.addEventListener('click', () => {
        updateQuantity(item.dishId, -1);
        renderCart();
      });

      itemEl.querySelector('.qty-btn-plus')?.addEventListener('click', () => {
        updateQuantity(item.dishId, 1);
        renderCart();
      });

      itemEl.querySelector('.item-remove-btn')?.addEventListener('click', () => {
        removeItem(item.dishId);
        toast.info(`Đã xóa "${item.name}" khỏi giỏ hàng.`);
        renderCart();
      });

      const noteInput = itemEl.querySelector('.item-note-input');
      noteInput?.addEventListener('change', (e) => {
        const cartCurrent = getCart();
        const curItem = cartCurrent.items.find(i => Number(i.dishId) === Number(item.dishId));
        if (curItem) {
          curItem.note = e.target.value.trim();
          saveCart(cartCurrent);
        }
      });

      listEl.appendChild(itemEl);
    });
  }

  renderSummary();
}

function renderSummary() {
  const subtotal = getCartSubtotal();
  const freeshipThreshold = 200000;
  let shippingFee = subtotal >= freeshipThreshold ? 0 : 15000;

  // Freeship Progress Bar
  const freeshipText = document.getElementById('freeship-progress-text');
  const freeshipStatus = document.getElementById('freeship-status-tag');
  const freeshipBar = document.getElementById('freeship-progress-bar');

  if (subtotal >= freeshipThreshold) {
    if (freeshipText) freeshipText.textContent = '🎉 Đơn hàng đã đủ điều kiện Miễn phí giao hàng!';
    if (freeshipStatus) freeshipStatus.textContent = '0đ (Free)';
    if (freeshipBar) freeshipBar.style.width = '100%';
  } else {
    const remain = freeshipThreshold - subtotal;
    const percent = Math.min(100, Math.round((subtotal / freeshipThreshold) * 100));
    if (freeshipText) freeshipText.textContent = `Thêm ${formatVND(remain)} để được Freeship 15k!`;
    if (freeshipStatus) freeshipStatus.textContent = '15k';
    if (freeshipBar) freeshipBar.style.width = `${percent}%`;
  }

  // Calculate discount
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      discount = Math.min(appliedCoupon.max || 50000, Math.round((subtotal * appliedCoupon.value) / 100));
    } else if (appliedCoupon.type === 'freeship') {
      discount = shippingFee;
    } else if (appliedCoupon.type === 'fixed') {
      if (subtotal >= (appliedCoupon.minOrder || 0)) {
        discount = appliedCoupon.value;
      }
    }
  }

  const total = Math.max(0, subtotal + shippingFee - discount);

  // Render price numbers
  const subtotalEl = document.getElementById('price-subtotal');
  const shippingEl = document.getElementById('price-shipping');
  const discountRow = document.getElementById('price-discount-row');
  const discountEl = document.getElementById('price-discount');
  const totalEl = document.getElementById('price-total');

  if (subtotalEl) subtotalEl.textContent = formatVND(subtotal);
  if (shippingEl) shippingEl.textContent = shippingFee === 0 ? 'Miễn phí (0 đ)' : formatVND(shippingFee);

  if (discountRow && discountEl) {
    if (discount > 0) {
      discountRow.classList.remove('hidden');
      discountEl.textContent = `-${formatVND(discount)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }

  if (totalEl) totalEl.textContent = formatVND(total);
}

// 3. Checkout Form submission
function setupCheckoutForm() {
  const form = document.getElementById('checkout-form');
  const guestWarning = document.getElementById('guest-checkout-warning');
  const user = getUser();
  const logged = isLoggedIn();

  if (logged && user) {
    guestWarning?.classList.add('hidden');
    const nameInput = document.getElementById('order-recipient-name');
    const phoneInput = document.getElementById('order-recipient-phone');
    const addrInput = document.getElementById('order-delivery-address');

    if (nameInput && !nameInput.value) nameInput.value = user.name || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
    if (addrInput && !addrInput.value) addrInput.value = user.address || '';
  } else {
    guestWarning?.classList.remove('hidden');
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isLoggedIn()) {
      toast.warning('Vui lòng đăng nhập tài khoản để đặt hàng.');
      setTimeout(() => {
        window.location.href = `/login.html?returnUrl=${encodeURIComponent('/cart.html')}`;
      }, 1000);
      return;
    }

    const cart = getCart();
    if (!cart.items || cart.items.length === 0) {
      toast.error('Giỏ hàng của bạn đang trống.');
      return;
    }

    if (isSubmitting) return;

    const recipientName = document.getElementById('order-recipient-name')?.value.trim();
    const recipientPhone = document.getElementById('order-recipient-phone')?.value.trim();
    const deliveryAddress = document.getElementById('order-delivery-address')?.value.trim();
    const note = document.getElementById('order-note')?.value.trim();

    if (!recipientName || recipientName.length < 2) {
      toast.warning('Vui lòng nhập họ tên người nhận.');
      return;
    }

    if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(recipientPhone)) {
      toast.warning('Số điện thoại không hợp lệ (cần 10 chữ số).');
      return;
    }

    if (!deliveryAddress || deliveryAddress.length < 5) {
      toast.warning('Vui lòng nhập địa chỉ giao hàng cụ thể.');
      return;
    }

    const submitBtn = document.getElementById('submit-order-btn');
    try {
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="inline-block animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
          <span>Đang tạo đơn hàng...</span>
        `;
      }

      const payload = {
        restaurantId: Number(cart.restaurantId),
        items: cart.items.map(i => ({
          dishId: Number(i.dishId || i.id),
          id: Number(i.dishId || i.id),
          name: i.name || '',
          price: i.price || '',
          priceNum: Number(i.priceNum) || 0,
          quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
          note: i.note ? String(i.note).trim() : ''
        })),
        recipientName,
        recipientPhone,
        deliveryAddress,
        note,
        paymentMethod: 'COD',
        couponCode: appliedCoupon ? appliedCoupon.code : undefined
      };

      const res = await api.post('/orders', payload);

      if (res && res.success && res.data) {
        // Xóa giỏ hàng local
        await clearCart();
        appliedCoupon = null;

        toast.success(`Đặt hàng thành công! Mã đơn: ${res.data.code}`);

        // Chuyển sang xem danh sách đơn hàng
        switchTab('orders');
      } else {
        toast.error(res?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Lỗi đặt hàng:', err);
      toast.error(err.message || 'Lỗi kết nối máy chủ khi tạo đơn hàng.');
    } finally {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span class="material-symbols-outlined text-[20px]">check_circle</span>
          <span>Xác nhận đặt hàng ngay</span>
        `;
      }
    }
  });
}

// 4. Lịch sử đơn hàng của tôi
async function loadMyOrders() {
  const authPrompt = document.getElementById('orders-auth-prompt');
  const emptyState = document.getElementById('orders-empty-state');
  const listContainer = document.getElementById('orders-list');
  const tabOrdersCount = document.getElementById('tab-orders-count');

  if (!isLoggedIn()) {
    authPrompt?.classList.remove('hidden');
    emptyState?.classList.add('hidden');
    if (listContainer) listContainer.innerHTML = '';
    return;
  }

  authPrompt?.classList.add('hidden');

  try {
    const res = await api.get('/orders/my');
    const orders = res && res.data ? res.data : [];

    if (tabOrdersCount) {
      tabOrdersCount.textContent = orders.length;
      if (orders.length > 0) tabOrdersCount.classList.remove('hidden');
    }

    if (orders.length === 0) {
      emptyState?.classList.remove('hidden');
      if (listContainer) listContainer.innerHTML = '';
      return;
    }

    emptyState?.classList.add('hidden');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    orders.forEach(order => {
      const statusMeta = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800 border-gray-300', icon: 'info' };
      const dateStr = formatDateTime(order.createdAt);

      const card = document.createElement('div');
      card.className = 'p-5 sm:p-6 rounded-3xl bg-surface-container-lowest border border-surface-container-high shadow-sm hover:shadow-md transition-all space-y-4';
      card.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-surface-container-high gap-2">
          <div class="flex items-center gap-3">
            <span class="text-xs text-secondary font-medium">Mã đơn:</span>
            <span class="text-sm font-black text-primary">${order.code}</span>
            <span class="text-xs text-secondary hidden sm:inline">•</span>
            <span class="text-xs text-secondary hidden sm:inline">${dateStr}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.color}">
              <span class="material-symbols-outlined text-[15px]">${statusMeta.icon}</span>
              <span>${statusMeta.label}</span>
            </span>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-2xl overflow-hidden bg-surface-container-high flex-shrink-0">
              <img src="${order.restaurantImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=150&q=80'}" alt="${order.restaurantName}" class="w-full h-full object-cover" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-on-surface">${order.restaurantName}</h4>
              <p class="text-xs text-secondary mt-0.5 line-clamp-1">${order.deliveryAddress}</p>
              <p class="text-[11px] text-secondary mt-1">
                ${order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
              </p>
            </div>
          </div>

          <div class="text-right flex sm:flex-col items-center sm:items-end justify-between flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-surface-container-high">
            <span class="text-xs text-secondary">Tổng thanh toán:</span>
            <span class="text-base font-black text-primary">${formatVND(order.total)}</span>
          </div>
        </div>

        <div class="pt-3 border-t border-surface-container-high flex items-center justify-between flex-wrap gap-2">
          <div class="text-xs text-secondary">
            <span class="font-medium">${order.paymentMethod === 'COD' ? 'Tiền mặt khi nhận hàng (COD)' : order.paymentMethod}</span>
            ${order.paymentStatus === 'paid' ? '• <span class="text-emerald-600 font-bold">Đã thanh toán</span>' : '• Chưa thanh toán'}
          </div>

          <div class="flex items-center gap-2">
            ${order.status === 'pending' ? `
              <button type="button" class="cancel-order-btn px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer" data-order-id="${order.id}" data-order-code="${order.code}">
                Hủy đơn
              </button>
            ` : ''}

            <button type="button" class="view-detail-btn px-4 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all cursor-pointer" data-order-id="${order.id}">
              Xem chi tiết & Tiến trình
            </button>
          </div>
        </div>
      `;

      // Event handlers
      card.querySelector('.view-detail-btn')?.addEventListener('click', () => {
        openOrderDetailModal(order);
      });

      card.querySelector('.cancel-order-btn')?.addEventListener('click', () => {
        pendingCancelOrderId = order.id;
        const codeSpan = document.getElementById('cancel-order-code');
        if (codeSpan) codeSpan.textContent = order.code;
        document.getElementById('cancel-order-modal')?.classList.remove('hidden');
      });

      listContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Lỗi tải danh sách đơn hàng:', err);
    toast.error('Không thể tải danh sách đơn hàng.');
  }
}

// 5. Modal chi tiết đơn hàng
function openOrderDetailModal(order) {
  const modal = document.getElementById('order-detail-modal');
  const codeEl = document.getElementById('modal-order-code');
  const bodyEl = document.getElementById('modal-order-body');

  if (codeEl) codeEl.textContent = order.code;
  if (!bodyEl) return;

  const statusMeta = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800', icon: 'info' };

  bodyEl.innerHTML = `
    <!-- Status Banner -->
    <div class="p-4 rounded-2xl border ${statusMeta.color} flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-[24px]">${statusMeta.icon}</span>
        <div>
          <p class="text-xs font-medium">Trạng thái hiện tại:</p>
          <p class="text-sm font-bold">${statusMeta.label}</p>
        </div>
      </div>
      <span class="text-xs font-medium">${formatDateTime(order.updatedAt || order.createdAt)}</span>
    </div>

    <!-- Timeline Tracking -->
    <div>
      <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">Tiến trình xử lý đơn</h4>
      <div class="space-y-3 pl-2 border-l-2 border-primary/30 ml-2">
        ${(order.timeline || []).map(tl => `
          <div class="relative pl-4">
            <div class="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20"></div>
            <p class="text-xs font-bold text-on-surface">${tl.message || STATUS_MAP[tl.status]?.label || tl.status}</p>
            <p class="text-[11px] text-secondary mt-0.5">${formatDateTime(tl.time)}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Items Breakdown -->
    <div>
      <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider mb-3">Món ăn đã đặt (${order.restaurantName})</h4>
      <div class="divide-y divide-surface-container-high bg-surface-container-low rounded-2xl p-4">
        ${order.items.map(item => `
          <div class="py-2.5 flex items-center justify-between text-xs">
            <div>
              <p class="font-bold text-on-surface">${item.name} <span class="text-secondary font-normal">x ${item.quantity}</span></p>
              ${item.note ? `<p class="text-[11px] text-secondary mt-0.5">Ghi chú: ${item.note}</p>` : ''}
            </div>
            <span class="font-bold text-primary">${formatVND(item.total || item.priceNum * item.quantity)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Recipient & Delivery Info -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-surface-container-low p-4 rounded-2xl">
      <div>
        <p class="text-secondary font-medium">Người nhận hàng:</p>
        <p class="font-bold text-on-surface mt-0.5">${order.recipientName} (${order.recipientPhone})</p>
        <p class="text-secondary font-medium mt-2">Địa chỉ giao hàng:</p>
        <p class="font-semibold text-on-surface mt-0.5">${order.deliveryAddress}</p>
      </div>
      <div>
        <p class="text-secondary font-medium">Ghi chú giao hàng:</p>
        <p class="font-semibold text-on-surface mt-0.5">${order.note || 'Không có ghi chú'}</p>
        <p class="text-secondary font-medium mt-2">Phương thức thanh toán:</p>
        <p class="font-semibold text-on-surface mt-0.5">${order.paymentMethod === 'COD' ? 'Tiền mặt khi nhận hàng (COD)' : order.paymentMethod}</p>
      </div>
    </div>

    <!-- Cost Summary -->
    <div class="space-y-1.5 pt-3 border-t border-surface-container-high text-xs">
      <div class="flex justify-between text-secondary">
        <span>Tạm tính món ăn:</span>
        <span class="font-bold text-on-surface">${formatVND(order.subtotal)}</span>
      </div>
      <div class="flex justify-between text-secondary">
        <span>Phí vận chuyển:</span>
        <span class="font-bold text-on-surface">${order.shippingFee === 0 ? 'Miễn phí' : formatVND(order.shippingFee)}</span>
      </div>
      ${order.discount > 0 ? `
        <div class="flex justify-between text-emerald-600 font-bold">
          <span>Ưu đãi (${order.couponCode || 'Giảm giá'}):</span>
          <span>-${formatVND(order.discount)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between text-base font-bold text-on-surface pt-2 border-t border-surface-container-high">
        <span>Tổng thanh toán:</span>
        <span class="text-primary font-black">${formatVND(order.total)}</span>
      </div>
    </div>
  `;

  modal?.classList.remove('hidden');
}

// 6. Setup Modal Listeners
function setupModals() {
  // Detail Modal
  document.getElementById('close-order-modal-btn')?.addEventListener('click', () => {
    document.getElementById('order-detail-modal')?.classList.add('hidden');
  });

  // Cancel Modal
  const cancelModal = document.getElementById('cancel-order-modal');
  document.getElementById('close-cancel-modal-btn')?.addEventListener('click', () => {
    cancelModal?.classList.add('hidden');
    pendingCancelOrderId = null;
  });

  document.getElementById('cancel-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingCancelOrderId) return;

    const reason = document.getElementById('cancel-reason-select')?.value || 'Khách hàng thay đổi ý định';

    try {
      const res = await api.patch(`/orders/${pendingCancelOrderId}/cancel`, { reason });
      if (res && res.success) {
        toast.success('Đã hủy đơn hàng thành công.');
        cancelModal?.classList.add('hidden');
        pendingCancelOrderId = null;
        loadMyOrders();
      } else {
        toast.error(res?.message || 'Không thể hủy đơn hàng.');
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hủy đơn hàng.');
    }
  });
}

function formatDateTime(iso) {
  if (!iso) return 'Vừa xong';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const two = n => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

