// FoodHub Register Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, setToken, setUser, isLoggedIn } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initFooter();

  if (isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const togglePwdBtn = document.getElementById('toggle-pwd-btn');
  const submitBtn = document.getElementById('register-submit-btn');
  const errorBox = document.getElementById('register-error');
  const errorText = document.getElementById('register-error-text');

  // Toggle password visibility
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPwd = passwordInput.type === 'password';
      passwordInput.type = isPwd ? 'text' : 'password';
      const icon = togglePwdBtn.querySelector('.material-symbols-outlined');
      icon.textContent = isPwd ? 'visibility_off' : 'visibility';
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

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!name || !email || !password) {
        showError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
        return;
      }

      if (password.length < 6) {
        showError('Mật khẩu cần có tối thiểu 6 ký tự.');
        return;
      }

      if (password !== confirmPassword) {
        showError('Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-70');
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
        <span>Đang khởi tạo tài khoản...</span>
      `;

      try {
        const res = await api.post('/auth/register', {
          name,
          email,
          phone,
          password,
          confirmPassword
        });

        if (res && res.success && res.token && res.user) {
          setToken(res.token);
          setUser(res.user);

          toast.success('Đăng ký tài khoản thành công! Đang chuyển hướng...');
          setTimeout(() => {
            window.location.href = '/index.html';
          }, 800);
        } else {
          showError((res && res.message) || 'Đăng ký không thành công.');
        }
      } catch (err) {
        showError(err.message || 'Không thể tạo tài khoản. Vui lòng thử lại.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-70');
        submitBtn.innerHTML = `
          <span>Đăng ký ngay</span>
          <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        `;
      }
    });
  }
});
