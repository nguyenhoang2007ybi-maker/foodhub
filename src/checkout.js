// src/checkout.js
// FoodHub Dedicated Checkout Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, getUser, isLoggedIn } from './auth.js';
import { getCart, saveCart, formatVND } from './cart.js';

let cart = null;
let savedAddresses = [];
let appliedCoupon = null;
let discountAmount = 0;

const VN_PHONE_REGEX = /^(?:\+?84|0)(3[2-9]|5[5-9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

document.addEventListener('DOMContentLoaded', async () => {
  initHeader();
  initFooter();

  // Kiểm tra đăng nhập
  if (!isLoggedIn()) {
    toast.warning('Vui lòng đăng nhập để tiến hành đặt hàng.');
    setTimeout(() => {
      window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    }, 800);
    return;
  }

  cart = getCart();

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    document.getElementById('checkout-empty-warning')?.classList.remove('hidden');
    document.getElementById('checkout-main-grid')?.classList.add('hidden');
    return;
  }

  // Tự động phân giải ID và cập nhật giá cho các món từ giỏ hàng cũ (nếu thiếu ID)
  if (cart.restaurantId) {
    try {
      const restRes = await api.get(`/restaurants/${cart.restaurantId}`);
      if (restRes && restRes.success && restRes.data && Array.isArray(restRes.data.menu)) {
        const menu = restRes.data.menu;
        let cartUpdated = false;
        cart.items.forEach(item => {
          const rawId = item.dishId !== undefined ? item.dishId : item.id;
          if (rawId === null || rawId === undefined || isNaN(Number(rawId))) {
            const match = menu.find(m => m.name && item.name && m.name.trim().toLowerCase() === item.name.trim().toLowerCase());
            if (match && match.id) {
              item.dishId = Number(match.id);
              item.id = Number(match.id);
              item.priceNum = Number(match.priceNum) || item.priceNum;
              cartUpdated = true;
            }
          }
        });
        if (cartUpdated) {
          saveCart(cart, true);
        }
      }
    } catch (e) {
      console.warn('Không thể kiểm tra thực đơn quán cho giỏ hàng:', e);
    }
  }

  // Pre-fill user information
  const currentUser = getUser();
  if (currentUser) {
    const nameInput = document.getElementById('order-recipient-name');
    const phoneInput = document.getElementById('order-recipient-phone');
    if (nameInput && !nameInput.value) nameInput.value = currentUser.name || '';
    if (phoneInput && !phoneInput.value && currentUser.phone) phoneInput.value = currentUser.phone;
  }

  setupAddressBook();
  setupAddressPreview();
  setupPaymentMethods();
  setupCoupons();
  renderOrderSummary();

  // Setup confirm button
  document.getElementById('confirm-place-order-btn')?.addEventListener('click', handlePlaceOrder);
});

// 1. Quản lý sổ địa chỉ đã lưu
async function setupAddressBook() {
  const box = document.getElementById('saved-addresses-box');
  const select = document.getElementById('saved-address-select');
  if (!box || !select) return;

  try {
    const res = await api.get('/auth/addresses');
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
      savedAddresses = res.data;
      box.classList.remove('hidden');

      select.innerHTML = '<option value="">-- Chọn từ sổ địa chỉ đã lưu --</option>';
      savedAddresses.forEach(addr => {
        const opt = document.createElement('option');
        opt.value = addr.id;
        opt.textContent = `${addr.recipientName} - ${addr.phone} (${addr.fullAddress})${addr.isDefault ? ' [Mặc định]' : ''}`;
        if (addr.isDefault) opt.selected = true;
        select.appendChild(opt);
      });

      // Nếu có địa chỉ mặc định, tự động điền
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      if (defaultAddr) {
        fillAddressFields(defaultAddr);
      }

      select.addEventListener('change', () => {
        const selectedId = Number(select.value);
        const addr = savedAddresses.find(a => Number(a.id) === selectedId);
        if (addr) {
          fillAddressFields(addr);
        }
      });
    }
  } catch (err) {
    console.warn('Không thể tải sổ địa chỉ:', err);
  }
}

function fillAddressFields(addr) {
  const nameInput = document.getElementById('order-recipient-name');
  const phoneInput = document.getElementById('order-recipient-phone');
  const districtSelect = document.getElementById('order-district');
  const wardInput = document.getElementById('order-ward');
  const streetInput = document.getElementById('order-street');

  if (nameInput) nameInput.value = addr.recipientName || '';
  if (phoneInput) phoneInput.value = addr.phone || '';
  if (districtSelect) districtSelect.value = addr.district || '';
  if (wardInput) wardInput.value = addr.ward || '';
  if (streetInput) streetInput.value = addr.street || '';

  updateAddressPreview();
}

// 2. Cập nhật preview địa chỉ hoàn chỉnh trực tiếp
function setupAddressPreview() {
  const inputs = ['order-province', 'order-district', 'order-ward', 'order-street'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateAddressPreview);
      el.addEventListener('change', updateAddressPreview);
    }
  });

  const phoneInput = document.getElementById('order-recipient-phone');
  const phoneFeedback = document.getElementById('phone-feedback');
  if (phoneInput && phoneFeedback) {
    phoneInput.addEventListener('input', () => {
      const val = phoneInput.value.trim();
      if (!val) {
        phoneFeedback.className = 'text-[11px] text-secondary mt-1';
        phoneFeedback.textContent = 'Đầu số hợp lệ: 03x, 05x, 07x, 08x, 09x (10 chữ số)';
      } else if (VN_PHONE_REGEX.test(val)) {
        phoneFeedback.className = 'text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1';
        phoneFeedback.innerHTML = '<span class="material-symbols-outlined text-[14px]">check_circle</span> Số điện thoại hợp lệ';
      } else {
        phoneFeedback.className = 'text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1';
        phoneFeedback.innerHTML = '<span class="material-symbols-outlined text-[14px]">error</span> Cần đúng 10 chữ số di động VN (03x, 05x, 07x, 08x, 09x)';
      }
    });
  }

  updateAddressPreview();
}

function getConstructedAddress() {
  const street = document.getElementById('order-street')?.value.trim() || '';
  const ward = document.getElementById('order-ward')?.value.trim() || '';
  const district = document.getElementById('order-district')?.value.trim() || '';
  const province = document.getElementById('order-province')?.value.trim() || 'Hà Nội';

  const parts = [street, ward ? `P. ${ward}` : '', district ? `Q. ${district}` : '', province].filter(Boolean);
  return {
    full: parts.join(', '),
    street,
    ward,
    district,
    province,
    isComplete: Boolean(street && district && ward)
  };
}

function updateAddressPreview() {
  const previewEl = document.getElementById('order-full-address-preview');
  if (!previewEl) return;
  const addr = getConstructedAddress();
  if (addr.isComplete) {
    previewEl.textContent = addr.full;
    previewEl.classList.remove('italic', 'text-secondary');
    previewEl.classList.add('text-on-surface');
  } else {
    previewEl.textContent = 'Vui lòng điền số nhà, phường/xã, quận/huyện...';
    previewEl.classList.add('italic', 'text-secondary');
    previewEl.classList.remove('text-on-surface');
  }
}

// 3. Phương thức thanh toán
function setupPaymentMethods() {
  const cards = document.querySelectorAll('.payment-method-card');
  const bankInfo = document.getElementById('bank-transfer-info-box');

  cards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    if (!radio) return;

    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('border-primary', 'bg-primary/5', 'border-2');
        c.classList.add('border-surface-container-high', 'border');
      });
      card.classList.add('border-primary', 'bg-primary/5', 'border-2');
      card.classList.remove('border-surface-container-high', 'border');
      radio.checked = true;

      if (radio.value === 'BANK_TRANSFER') {
        bankInfo?.classList.remove('hidden');
      } else {
        bankInfo?.classList.add('hidden');
      }
    });
  });
}

// 4. Render thông tin giỏ hàng & tính giá
function renderOrderSummary() {
  const restNameEl = document.getElementById('checkout-rest-name');
  if (restNameEl) restNameEl.textContent = cart.restaurantName || 'Quán ăn';

  const itemsContainer = document.getElementById('checkout-items-list');
  if (!itemsContainer) return;

  itemsContainer.innerHTML = '';
  let subtotal = 0;

  cart.items.forEach(item => {
    const priceNum = Number(item.priceNum) || 0;
    const qty = Number(item.quantity) || 1;
    const itemTotal = priceNum * qty;
    subtotal += itemTotal;

    const row = document.createElement('div');
    row.className = 'py-3 flex items-center justify-between gap-3 text-xs';
    row.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" alt="${item.name}" class="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
        <div class="min-w-0">
          <p class="font-bold text-on-surface truncate">${item.name}</p>
          <p class="text-[11px] text-secondary">Số lượng: <strong class="text-on-surface">${qty}</strong> suất</p>
        </div>
      </div>
      <span class="font-bold text-on-surface flex-shrink-0">${formatVND(itemTotal)}</span>
    `;
    itemsContainer.appendChild(row);
  });

  // Phí ship: 15.000 đ, miễn phí nếu đơn >= 200.000 đ
  const shippingFee = subtotal >= 200000 ? 0 : 15000;
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  document.getElementById('checkout-price-subtotal').textContent = formatVND(subtotal);
  document.getElementById('checkout-price-shipping').textContent = shippingFee === 0 ? 'Miễn phí (Đơn >= 200k)' : formatVND(shippingFee);

  const discountRow = document.getElementById('checkout-discount-row');
  const discountEl = document.getElementById('checkout-price-discount');
  if (discountAmount > 0) {
    discountRow?.classList.remove('hidden');
    if (discountEl) discountEl.textContent = `-${formatVND(discountAmount)}`;
  } else {
    discountRow?.classList.add('hidden');
  }

  document.getElementById('checkout-price-total').textContent = formatVND(total);
}

// 5. Quản lý mã giảm giá (Coupons)
function setupCoupons() {
  const applyBtn = document.getElementById('checkout-apply-coupon-btn');
  const couponInput = document.getElementById('checkout-coupon-input');
  const removeBtn = document.getElementById('remove-coupon-btn');
  const appliedBox = document.getElementById('applied-coupon-box');
  const appliedLabel = document.getElementById('applied-coupon-label');
  const pillsContainer = document.getElementById('checkout-coupon-pills');

  const handleApply = async (code) => {
    const cleanCode = (code || couponInput?.value || '').trim().toUpperCase();
    if (!cleanCode) {
      toast.warning('Vui lòng nhập mã giảm giá.');
      return;
    }

    const subtotal = cart.items.reduce((sum, item) => sum + (Number(item.priceNum) || 0) * (Number(item.quantity) || 1), 0);

    try {
      const res = await api.post('/coupons/validate', {
        code: cleanCode,
        subtotal,
        restaurantId: cart.restaurantId
      });

      if (res && res.valid) {
        appliedCoupon = res.coupon;
        discountAmount = Number(res.discount) || 0;
        sessionStorage.setItem('foodhub_pending_coupon', cleanCode);
        toast.success(res.message || `Đã áp dụng mã ${cleanCode}!`);

        if (appliedBox) appliedBox.classList.remove('hidden');
        if (appliedLabel) appliedLabel.textContent = `Đã áp dụng mã ${cleanCode} (-${formatVND(discountAmount)})`;
        if (couponInput) couponInput.value = cleanCode;

        renderOrderSummary();
      } else {
        toast.error(res?.message || 'Mã giảm giá không hợp lệ.');
      }
    } catch (err) {
      console.error('Lỗi áp dụng mã coupon:', err);
      toast.error(err.message || 'Mã giảm giá không hợp lệ hoặc đã hết lượt.');
    }
  };

  if (applyBtn) applyBtn.addEventListener('click', () => handleApply());

  couponInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  });

  const bindPills = (root) => {
    root.querySelectorAll('.coupon-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const code = pill.dataset.code;
        if (couponInput) couponInput.value = code;
        handleApply(code);
      });
    });
  };

  if (pillsContainer) {
    bindPills(pillsContainer);
  }

  // Tải danh sách mã gợi ý động từ backend
  api.get('/coupons/public').then(res => {
    if (res && res.success && Array.isArray(res.data) && res.data.length > 0 && pillsContainer) {
      pillsContainer.innerHTML = `<span class="text-[11px] text-secondary">Gợi ý:</span>` +
        res.data.slice(0, 5).map(c => {
          let label = c.code;
          if (c.type === 'percent') label += ` (-${c.value}%)`;
          else if (c.type === 'fixed') label += ` (-${Math.round(c.value / 1000)}k)`;
          else if (c.type === 'freeship') label += ` (Freeship)`;
          return `<button type="button" class="coupon-pill text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-container-high hover:bg-primary-container hover:text-white transition-colors cursor-pointer" data-code="${c.code}">${label}</button>`;
        }).join('');

      bindPills(pillsContainer);
    }
  }).catch(() => {});

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      appliedCoupon = null;
      discountAmount = 0;
      sessionStorage.removeItem('foodhub_pending_coupon');
      if (appliedBox) appliedBox.classList.add('hidden');
      if (couponInput) couponInput.value = '';
      toast.info('Đã gỡ mã giảm giá.');
      renderOrderSummary();
    });
  }

  // Tự động kiểm tra và áp dụng mã nếu đã được chọn ở trang giỏ hàng
  const pendingCode = sessionStorage.getItem('foodhub_pending_coupon');
  if (pendingCode && cart.items.length > 0) {
    if (couponInput) couponInput.value = pendingCode;
    handleApply(pendingCode);
  }
}

// 6. Xử lý tạo đơn hàng
async function handlePlaceOrder() {
  const nameInput = document.getElementById('order-recipient-name');
  const phoneInput = document.getElementById('order-recipient-phone');
  const noteInput = document.getElementById('order-note');
  const saveAddrCheckbox = document.getElementById('save-to-address-book');
  const confirmBtn = document.getElementById('confirm-place-order-btn');

  const recipientName = nameInput?.value.trim() || '';
  const rawPhone = phoneInput?.value.trim() || '';
  const note = noteInput?.value.trim() || '';
  const addrInfo = getConstructedAddress();

  if (!recipientName || recipientName.length < 2) {
    toast.error('Vui lòng nhập họ và tên người nhận (tối thiểu 2 ký tự).');
    nameInput?.focus();
    return;
  }

  if (!VN_PHONE_REGEX.test(rawPhone)) {
    toast.error('Số điện thoại không đúng chuẩn di động Việt Nam (10 số, bắt đầu 03x, 05x, 07x, 08x, 09x).');
    phoneInput?.focus();
    return;
  }

  if (!addrInfo.isComplete) {
    toast.error('Vui lòng điền đầy đủ thông tin địa chỉ: Số nhà, Phường/Xã và Quận/Huyện.');
    return;
  }

  // Kiểm tra tính hợp lệ của từng món trong giỏ trước khi gửi
  const invalidItem = cart.items.find(item => {
    const rawId = item.dishId !== undefined ? item.dishId : item.id;
    return rawId === null || rawId === undefined || isNaN(Number(rawId));
  });

  if (invalidItem) {
    toast.error(`Món "${invalidItem.name || 'chưa xác định'}" không có mã món hợp lệ. Vui lòng quay lại giỏ hàng để cập nhật hoặc xóa món này.`);
    return;
  }

  const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';

  // Khóa nút tránh gửi trùng lặp
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span><span>Đang xử lý đơn hàng...</span>';
  }

  try {
    // Nếu chọn lưu địa chỉ, lưu vào sổ địa chỉ
    if (saveAddrCheckbox?.checked) {
      api.post('/auth/addresses', {
        recipientName,
        phone: rawPhone,
        province: addrInfo.province,
        district: addrInfo.district,
        ward: addrInfo.ward,
        street: addrInfo.street
      }).catch(err => console.warn('Lỗi lưu sổ địa chỉ:', err));
    }

    const payload = {
      restaurantId: Number(cart.restaurantId),
      items: cart.items.map(item => {
        const rawId = item.dishId !== undefined ? item.dishId : item.id;
        const numId = (rawId !== null && rawId !== undefined && !isNaN(Number(rawId)) && Number(rawId) > 0) ? Number(rawId) : undefined;
        return {
          dishId: numId,
          id: numId,
          name: item.name || '',
          price: item.price || '',
          priceNum: Number(item.priceNum) || 0,
          quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
          note: item.note ? String(item.note).trim() : ''
        };
      }),
      recipientName,
      recipientPhone: rawPhone,
      deliveryAddress: addrInfo.full,
      addressDetails: {
        province: addrInfo.province,
        district: addrInfo.district,
        ward: addrInfo.ward,
        street: addrInfo.street
      },
      note,
      paymentMethod: selectedPayment,
      couponCode: appliedCoupon ? appliedCoupon.code : ''
    };

    const res = await api.post('/orders', payload);

    if (res && res.success && res.data) {
      toast.success('Đặt hàng thành công! Đang chuyển đến trang theo dõi đơn hàng...');
      sessionStorage.removeItem('foodhub_pending_coupon');
      // Xóa sạch giỏ hàng local
      saveCart({
        restaurantId: null,
        restaurantName: '',
        restaurantAddress: '',
        items: []
      }, false);

      setTimeout(() => {
        window.location.href = `/order-tracking.html?id=${res.data.code || res.data.id}`;
      }, 1000);
    } else {
      throw new Error(res.message || 'Không thể tạo đơn hàng.');
    }
  } catch (err) {
    console.error('Lỗi đặt hàng:', err);
    toast.error(err.message || 'Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>Xác nhận đặt hàng ngay</span><span class="material-symbols-outlined text-[20px]">arrow_forward</span>';
    }
  }
}

