// FoodHub Forgot & Reset Password Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initFooter();

  const step1 = document.getElementById('step-request-token');
  const step2 = document.getElementById('step-reset-password');
  const forgotForm = document.getElementById('forgot-form');
  const resetForm = document.getElementById('reset-form');
  const alertBox = document.getElementById('alert-box');

  const forgotEmailInput = document.getElementById('forgot-email');
  const resetTokenInput = document.getElementById('reset-token-input');
  const tokenDisplay = document.getElementById('generated-token-display');
  const newPasswordInput = document.getElementById('new-password');
  const confirmNewPasswordInput = document.getElementById('confirm-new-password');

  const showAlert = (msg, type = 'error') => {
    alertBox.className = `mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`;
    alertBox.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${type === 'error' ? 'error' : 'check_circle'}</span>
      <span>${msg}</span>
    `;
    alertBox.classList.remove('hidden');
  };

  const hideAlert = () => alertBox.classList.add('hidden');

  // Check if token already provided in URL
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    resetTokenInput.value = tokenFromUrl;
    tokenDisplay.textContent = tokenFromUrl;
  }

  // Handle Step 1
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email = forgotEmailInput.value.trim();
      if (!email) {
        showAlert('Vui lòng nhập địa chỉ email.');
        return;
      }

      try {
        const res = await api.post('/auth/forgot-password', { email });
        if (res && res.success && res.resetToken) {
          step1.classList.add('hidden');
          step2.classList.remove('hidden');
          resetTokenInput.value = res.resetToken;
          tokenDisplay.textContent = res.resetToken;
          showAlert('Mã xác nhận đặt lại mật khẩu đã được tạo! Vui lòng nhập mật khẩu mới dưới đây.', 'success');
        } else {
          showAlert((res && res.message) || 'Không tìm thấy tài khoản với email này.');
        }
      } catch (err) {
        showAlert(err.message || 'Lỗi khi yêu cầu đặt lại mật khẩu.');
      }
    });
  }

  // Handle Step 2
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const token = resetTokenInput.value.trim();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmNewPasswordInput.value;

      if (!token) {
        showAlert('Thiếu mã xác nhận đặt lại mật khẩu.');
        return;
      }

      if (newPassword.length < 6) {
        showAlert('Mật khẩu mới phải có tối thiểu 6 ký tự.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert('Mật khẩu xác nhận không khớp.');
        return;
      }

      try {
        const res = await api.post('/auth/reset-password', {
          token,
          newPassword,
          confirmPassword
        });

        if (res && res.success) {
          toast.success('Đặt lại mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.');
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 1200);
        } else {
          showAlert((res && res.message) || 'Không thể đặt lại mật khẩu.');
        }
      } catch (err) {
        showAlert(err.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
      }
    });
  }
});

