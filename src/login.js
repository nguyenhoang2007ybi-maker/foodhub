// FoodHub Login Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, setToken, setUser, isLoggedIn, isAdmin } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initFooter();

  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('returnUrl');

  // If already logged in, redirect
  if (isLoggedIn()) {
    if (returnUrl) window.location.href = returnUrl;
    else if (isAdmin()) window.location.href = '/admin.html';
    else window.location.href = '/index.html';
    return;
  }

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePwdBtn = document.getElementById('toggle-pwd-btn');
  const submitBtn = document.getElementById('login-submit-btn');
  const errorBox = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');

  // Password visibility toggle
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      const icon = togglePwdBtn.querySelector('.material-symbols-outlined');
      icon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  // Demo accounts helper
  const fillAdminBtn = document.getElementById('fill-admin-btn');
  const fillCustomerBtn = document.getElementById('fill-customer-btn');

  if (fillAdminBtn) {
    fillAdminBtn.addEventListener('click', () => {
      emailInput.value = 'admin@foodhub.vn';
      passwordInput.value = 'Admin@FoodHub2026!';
      hideError();
    });
  }

  if (fillCustomerBtn) {
    fillCustomerBtn.addEventListener('click', () => {
      emailInput.value = 'khachhang@foodhub.vn';
      passwordInput.value = 'Khach@FoodHub2026!';
      hideError();
    });
  }

  const showError = (msg) => {
    if (errorBox && errorText) {
      errorText.textContent = msg;
      errorBox.classList.remove('hidden');
    } else {
      toast.error(msg);
    }
  };

  const hideError = () => {
    if (errorBox) errorBox.classList.add('hidden');
  };

  // Form submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        showError('Vui lòng điền đầy đủ email và mật khẩu.');
        return;
      }

      // Show loading
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-70');
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
        <span>Đang xác thực...</span>
      `;

      try {
        const res = await api.post('/auth/login', { email, password });
        if (res && res.success && res.token && res.user) {
          setToken(res.token);
          setUser(res.user);

          toast.success(`Đăng nhập thành công! Chào mừng ${res.user.name}.`);

          setTimeout(() => {
            if (returnUrl) {
              window.location.href = returnUrl;
            } else if (res.user.role === 'admin') {
              window.location.href = '/admin.html';
            } else {
              window.location.href = '/index.html';
            }
          }, 800);
        } else {
          showError((res && res.message) || 'Đăng nhập không thành công.');
        }
      } catch (err) {
        showError(err.message || 'Email hoặc mật khẩu không chính xác.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-70');
        submitBtn.innerHTML = `
          <span>Đăng nhập</span>
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        `;
      }
    });
  }
});

