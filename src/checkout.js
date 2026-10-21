// FoodHub Checkout Page Controller (đặt hàng + xác nhận email OTP)
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, requireAuth, getUser } from './auth.js';
import {
  getCart,
  clearCart,
  getCartCount,
  getCartSubtotal,
  calculateOrderSummary,
  formatVND,
  updateCartBadge,
  getAppliedCoupon,
  clearAppliedCoupon
} from './cart.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
const RESEND_COOLDOWN_SECONDS = 60;

// Trạng thái xác nhận email
let verifiedEmail = null;
let verificationToken = null;
let resendTimer = null;
let isSubmitting = false;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  initHeader('cart');
  initFooter();

  // Bắt buộc đăng nhập để thanh toán
  if (!requireAuth()) return;

  const cart = getCart();

  if (!cart.items || cart.items.length === 0) {
    showBlockedState({
      icon: 'shopping_cart',
      title: 'Giỏ hàng của bạn đang trống',
      desc: 'Hãy thêm món ăn vào giỏ trước khi tiến hành thanh toán.',
      actionText: 'Tiếp tục mua sắm',
      actionHref: '/explore.html'
    });
    return;
  }

  $('checkout-content')?.classList.remove('hidden');

  prefillRecipient();
  renderOrderSummary();
  setupPaymentOptions();
  setupAddressPreview();
  setupEmailVerification();
  setupSubmit();

  updateCartBadge();
});

function showBlockedState({ icon, title, desc, actionText, actionHref }) {
  $('checkout-content')?.classList.add('hidden');
  const state = $('checkout-blocked-state');
  if (!state) return;
  $('blocked-icon').textContent = icon;
  $('blocked-title').textContent = title;
  $('blocked-desc').textContent = desc;
  const action = $('blocked-action');
  if (action) {
    action.href = actionHref;
    action.querySelector('span:last-child').textContent = actionText;
  }
  state.classList.remove('hidden');
}

function prefillRecipient() {
  const user = getUser();
  if (!user) return;
  const nameInput = $('co-name');
  const phoneInput = $('co-phone');
  const emailInput = $('co-email');
  if (nameInput && !nameInput.value) nameInput.value = user.name || '';
  if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
  if (emailInput && !emailInput.value) emailInput.value = user.email || '';
}

// 1. Tổng kết đơn hàng ở cột phải
function renderOrderSummary() {
  const cart = getCart();
  const listEl = $('checkout-items-list');
  const countEl = $('chk-items-count');
  const restEl = $('chk-restaurant-name');

  if (restEl) restEl.textContent = cart.restaurantName || 'Quán ăn';
  if (countEl) countEl.textContent = getCartCount();

  if (listEl) {
    listEl.innerHTML = '';
    cart.items.forEach(item => {
      const priceUnit = item.priceNum || (parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10) || 0);
      const lineTotal = priceUnit * Number(item.quantity || 0);

      const fallbackImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
      const row = document.createElement('div');
      row.className = 'py-3 flex items-center gap-3';
      row.innerHTML = [
        '<div class="w-14 h-14 rounded-2xl overflow-hidden bg-surface-container-high flex-shrink-0 shadow-sm border border-surface-container-high">',
        '  <img src="' + (item.image || fallbackImg) + '" alt="' + item.name + '" class="w-full h-full object-cover" onerror="this.src=\'' + fallbackImg + '\'" />',
        '</div>',
        '<div class="min-w-0 flex-1">',
        '  <p class="text-xs font-bold text-on-surface truncate">' + item.name + '</p>',
        (item.note ? '  <p class="text-[10px] text-secondary truncate">Ghi chú: ' + item.note + '</p>' : ''),
        '  <p class="text-[11px] text-secondary mt-0.5">',
        '    Đơn giá: <span class="font-semibold text-primary">' + formatVND(priceUnit) + '</span> × ' + item.quantity,
        '  </p>',
        '</div>',
        '<div class="text-right">',
        '  <span class="text-xs font-bold text-on-surface whitespace-nowrap">' + formatVND(lineTotal) + '</span>',
        '</div>'
      ].filter(Boolean).join('');
      listEl.appendChild(row);
    });
  }

  // Coupon đã chọn ở trang giỏ hàng
  const coupon = getAppliedCoupon();
  const couponBadge = $('chk-coupon-badge');
  const couponText = $('chk-coupon-text');
  if (coupon) {
    if (couponText) couponText.textContent = `Đã áp dụng mã ${coupon.code} — ${coupon.description}`;
    couponBadge?.classList.remove('hidden');
  } else {
    couponBadge?.classList.add('hidden');
  }

  const subtotal = getCartSubtotal();
  const { shippingFee, discount, total } = calculateOrderSummary(subtotal, coupon);

  if ($('chk-subtotal')) $('chk-subtotal').textContent = formatVND(subtotal);
  if ($('chk-shipping')) $('chk-shipping').textContent = shippingFee === 0 ? 'Miễn phí (0 đ)' : formatVND(shippingFee);

  const discountRow = $('chk-discount-row');
  if (discountRow) {
    if (discount > 0) {
      discountRow.classList.remove('hidden');
      if ($('chk-discount')) $('chk-discount').textContent = `-${formatVND(discount)}`;
    } else {
      discountRow.classList.add('hidden');
    }
  }

  if ($('chk-total')) $('chk-total').textContent = formatVND(total);
}

// 2. Chọn phương thức thanh toán
function setupPaymentOptions() {
  const options = document.querySelectorAll('.payment-option');
  options.forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    if (!radio) return;

    const sync = () => {
      options.forEach(opt => {
        const r = opt.querySelector('input[type="radio"]');
        if (r && r.checked) {
          opt.classList.add('border-primary', 'bg-primary/5');
          opt.classList.remove('border-surface-container-high', 'bg-surface-container-low');
        } else {
          opt.classList.remove('border-primary', 'bg-primary/5');
          opt.classList.add('border-surface-container-high', 'bg-surface-container-low');
        }
      });
    };

    radio.addEventListener('change', sync);
    sync();
  });
}

// 3. Xem trước địa chỉ giao hàng
function setupAddressPreview() {
  const fields = ['co-street', 'co-extra', 'co-ward', 'co-district', 'co-province'];
  const update = () => {
    const preview = $('address-preview');
    if (!preview) return;
    const parts = fields
      .map(id => ($(id)?.value || '').trim())
      .filter(Boolean);
    preview.textContent = parts.length >= 1 ? parts.join(', ') : 'Vui lòng điền địa chỉ ở trên';
  };
  fields.forEach(id => $(id)?.addEventListener('input', update));
}

// 4. Xác nhận email bằng OTP
function setupEmailVerification() {
  $('send-otp-btn')?.addEventListener('click', () => sendOtp(false));
  $('resend-otp-btn')?.addEventListener('click', () => sendOtp(true));
  $('verify-otp-btn')?.addEventListener('click', verifyOtp);

  // Cho phép Enter để xác nhận mã
  $('co-otp')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      verifyOtp();
    }
  });

  // Chỉ nhận ký tự số cho ô OTP
  $('co-otp')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  });

  // Nếu người dùng đổi email khác sau khi đã xác nhận -> hủy trạng thái xác nhận
  $('co-email')?.addEventListener('input', () => {
    const current = ($('co-email')?.value || '').trim().toLowerCase();
    if (verifiedEmail && current !== verifiedEmail) {
      resetEmailVerification();
    }
  });
}

async function sendOtp(isResend) {
  const email = ($('co-email')?.value || '').trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    toast.warning('Vui lòng nhập địa chỉ email hợp lệ trước khi gửi mã xác nhận.');
    $('co-email')?.focus();
    return;
  }

  const sendBtn = $('send-otp-btn');
  if (sendBtn && !isResend) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Đang gửi...';
  }

  try {
    const res = await api.post('/email/send-otp', { email });

    if (res && res.success) {
      $('otp-panel')?.classList.remove('hidden');

      // Nếu backend chưa cấu hình SMTP, mã OTP được trả về cho môi trường dev.
      const devNotice = $('otp-dev-notice');
      const devNoticeText = $('otp-dev-notice-text');
      if (res.devCode && devNotice && devNoticeText) {
        devNoticeText.innerHTML = `Máy chủ chưa cấu hình SMTP. Mã OTP dành cho môi trường phát triển: <b class="tracking-widest">${res.devCode}</b>.`;
        devNotice.classList.remove('hidden');
      } else if (devNotice) {
        devNotice.classList.add('hidden');
      }

      toast.success(res.message || 'Đã gửi mã xác nhận tới email của bạn.');
      startResendCooldown(RESEND_COOLDOWN_SECONDS);
      $('co-otp')?.focus();
    } else {
      toast.error((res && res.message) || 'Không thể gửi mã xác nhận. Vui lòng thử lại.');
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi gửi mã xác nhận email.');
  } finally {
    if (sendBtn && !isResend) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Gửi lại mã';
    }
  }
}

function startResendCooldown(seconds) {
  const resendBtn = $('resend-otp-btn');
  const countdownEl = $('otp-countdown');
  let remaining = seconds;

  if (resendTimer) clearInterval(resendTimer);

  if (resendBtn) resendBtn.disabled = true;

  const render = () => {
    if (remaining > 0) {
      if (countdownEl) countdownEl.textContent = `Mã hiệu lực, gửi lại sau ${remaining}s`;
      if (resendBtn) resendBtn.textContent = `Gửi lại mã sau ${remaining}s`;
      remaining -= 1;
    } else {
      clearInterval(resendTimer);
      resendTimer = null;
      if (countdownEl) countdownEl.textContent = '';
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Chưa nhận được mã? Gửi lại';
      }
    }
  };

  render();
  resendTimer = setInterval(render, 1000);
}

async function verifyOtp() {
  const email = ($('co-email')?.value || '').trim();
  const otp = ($('co-otp')?.value || '').trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    toast.warning('Địa chỉ email không hợp lệ.');
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    toast.warning('Mã xác nhận phải gồm đúng 6 chữ số.');
    return;
  }

  const verifyBtn = $('verify-otp-btn');
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Đang kiểm tra...';
  }

  try {
    const res = await api.post('/email/verify-otp', { email, otp });

    if (res && res.success && res.verificationToken) {
      verifiedEmail = (res.email || email).toLowerCase();
      verificationToken = res.verificationToken;
      markEmailVerified();
      toast.success(res.message || 'Xác nhận email thành công!');
    } else {
      toast.error((res && res.message) || 'Mã xác nhận không chính xác.');
    }
  } catch (err) {
    toast.error(err.message || 'Mã xác nhận không chính xác hoặc đã hết hạn.');
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Xác nhận mã';
    }
  }
}

function markEmailVerified() {
  $('email-verified-badge')?.classList.remove('hidden');
  $('otp-panel')?.classList.add('hidden');
  $('otp-dev-notice')?.classList.add('hidden');

  const emailInput = $('co-email');
  if (emailInput) emailInput.disabled = true;

  const sendBtn = $('send-otp-btn');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Đã xác nhận';
  }

  const hint = $('email-verify-hint');
  if (hint) {
    hint.textContent = 'Email đã được xác nhận. Bạn có thể tiếp tục hoàn tất đặt hàng.';
    hint.className = 'text-[11px] text-emerald-600 mt-1.5 font-semibold';
  }

  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
}

function resetEmailVerification() {
  verifiedEmail = null;
  verificationToken = null;

  $('email-verified-badge')?.classList.add('hidden');
  $('otp-panel')?.classList.add('hidden');
  $('otp-dev-notice')?.classList.add('hidden');
  $('otp-countdown') && ($('otp-countdown').textContent = '');
  if ($('co-otp')) $('co-otp').value = '';

  const hint = $('email-verify-hint');
  if (hint) {
    hint.textContent = 'Chúng tôi sẽ gửi mã OTP gồm 6 chữ số tới email này. Bạn phải xác nhận email mới có thể đặt hàng.';
    hint.className = 'text-[11px] text-secondary mt-1.5';
  }

  const sendBtn = $('send-otp-btn');
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Gửi mã xác nhận';
  }

  if (resendTimer) {
    clearInterval(resendTimer);
    resendTimer = null;
  }
}

// 5. Đặt hàng
function setupSubmit() {
  $('place-order-btn')?.addEventListener('click', placeOrder);

  // Đặt hàng khi nhấn Enter trong form (trừ textarea)
  $('checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    placeOrder();
  });
}

function buildDeliveryAddress() {
  const street = ($('co-street')?.value || '').trim();
  const extra = ($('co-extra')?.value || '').trim();
  const ward = ($('co-ward')?.value || '').trim();
  const district = ($('co-district')?.value || '').trim();
  const province = ($('co-province')?.value || '').trim();

  const streetPart = extra ? `${street}, ${extra}` : street;
  return [streetPart, ward, district, province].filter(Boolean).join(', ');
}

async function placeOrder() {
  if (isSubmitting) return;

  const cart = getCart();
  if (!cart.items || cart.items.length === 0) {
    toast.error('Giỏ hàng của bạn đang trống.');
    return;
  }

  const recipientName = ($('co-name')?.value || '').trim();
  const recipientPhone = ($('co-phone')?.value || '').trim();
  const contactEmail = ($('co-email')?.value || '').trim().toLowerCase();
  const province = ($('co-province')?.value || '').trim();
  const district = ($('co-district')?.value || '').trim();
  const ward = ($('co-ward')?.value || '').trim();
  const street = ($('co-street')?.value || '').trim();
  const note = ($('co-note')?.value || '').trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';

  if (recipientName.length < 2) {
    toast.warning('Vui lòng nhập họ tên người nhận (tối thiểu 2 ký tự).');
    $('co-name')?.focus();
    return;
  }

  if (!PHONE_REGEX.test(recipientPhone)) {
    toast.warning('Số điện thoại không hợp lệ (cần 10 chữ số, ví dụ 0912345678).');
    $('co-phone')?.focus();
    return;
  }

  if (!contactEmail || !EMAIL_REGEX.test(contactEmail)) {
    toast.warning('Vui lòng nhập địa chỉ email hợp lệ.');
    return;
  }

  // Bắt buộc xác nhận email trước khi đặt hàng
  if (!verifiedEmail || !verificationToken || contactEmail !== verifiedEmail) {
    toast.error('Email chưa được xác nhận. Vui lòng gửi và xác nhận mã OTP trước khi đặt hàng.');
    $('otp-panel')?.classList.remove('hidden');
    $('co-email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!province || !district || !ward || street.length < 2) {
    toast.warning('Vui lòng nhập đầy đủ Tỉnh/Thành phố, Quận/Huyện, Phường/Xã và số nhà/tên đường.');
    return;
  }

  const deliveryAddress = buildDeliveryAddress();

  const btn = $('place-order-btn');
  try {
    isSubmitting = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span class="inline-block animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
        <span>Đang tạo đơn hàng...</span>
      `;
    }

    const payload = {
      restaurantId: cart.restaurantId,
      items: cart.items.map(i => ({
        dishId: i.dishId,
        name: i.name,
        quantity: i.quantity,
        note: i.note
      })),
      recipientName,
      recipientPhone,
      contactEmail,
      emailVerificationToken: verificationToken,
      deliveryAddress,
      note,
      paymentMethod,
      couponCode: (getAppliedCoupon() || {}).code
    };

    const res = await api.post('/orders', payload);

    if (res && res.success && res.data) {
      await clearCart();
      clearAppliedCoupon();
      updateCartBadge();

      const code = res.data.code || res.data.id;
      const codeEl = $('success-order-code');
      if (codeEl) codeEl.textContent = code;
      $('checkout-success-modal')?.classList.remove('hidden');

      toast.success(`Đặt hàng thành công! Mã đơn: ${code}`);
    } else {
      toast.error((res && res.message) || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    }
  } catch (err) {
    console.error('Lỗi đặt hàng:', err);
    toast.error(err.message || 'Lỗi kết nối máy chủ khi tạo đơn hàng.');
  } finally {
    isSubmitting = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <span class="material-symbols-outlined text-[20px]">check_circle</span>
        <span>Đặt hàng</span>
      `;
    }
  }
}
