// FoodHub Profile Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, requireAuth, setUser, getUser } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  initHeader();
  initFooter();

  setupTabs();
  await loadUserData();
  setupForms();
});

function setupTabs() {
  const tabInfoBtn = document.getElementById('tab-info-btn');
  const tabPasswordBtn = document.getElementById('tab-password-btn');
  const tabMyReviewsBtn = document.getElementById('tab-my-reviews-btn');

  const panelInfo = document.getElementById('panel-info');
  const panelPassword = document.getElementById('panel-password');
  const panelMyReviews = document.getElementById('panel-my-reviews');

  const tabs = [
    { btn: tabInfoBtn, panel: panelInfo },
    { btn: tabPasswordBtn, panel: panelPassword },
    { btn: tabMyReviewsBtn, panel: panelMyReviews, onLoad: loadMyReviews }
  ];

  tabs.forEach(({ btn, panel, onLoad }) => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-low text-left transition-all';
        t.panel.classList.add('hidden');
      });

      btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-left transition-all bg-primary-container text-on-primary';
      panel.classList.remove('hidden');

      if (onLoad) onLoad();
    });
  });
}

async function loadUserData() {
  try {
    const res = await api.get('/auth/me');
    if (res && res.success && (res.user || res.data)) {
      const user = res.user || res.data;
      setUser(user);

      // Update sidebar
      const avatarEl = document.getElementById('profile-avatar');
      const nameEl = document.getElementById('profile-name');
      const emailEl = document.getElementById('profile-email');
      const roleBadge = document.getElementById('profile-role-badge');
      const statReviews = document.getElementById('stat-reviews');
      const statFavs = document.getElementById('stat-favorites');

      if (avatarEl) avatarEl.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff6b35&color=fff`;
      if (nameEl) nameEl.textContent = user.name;
      if (emailEl) emailEl.textContent = user.email;

      if (roleBadge) {
        if (user.role === 'admin') {
          roleBadge.className = 'mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800';
          roleBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">shield_person</span> Quản trị viên`;
        } else {
          roleBadge.className = 'mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-primary-container/15 text-primary';
          roleBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">person</span> Khách hàng`;
        }
      }

      if (statReviews) statReviews.textContent = user.reviewsCount || 0;
      if (statFavs) statFavs.textContent = user.favoritesCount || 0;

      // Populate Form inputs
      const editName = document.getElementById('edit-name');
      const editEmail = document.getElementById('edit-email');
      const editPhone = document.getElementById('edit-phone');
      const editAvatar = document.getElementById('edit-avatar');

      if (editName) editName.value = user.name || '';
      if (editEmail) editEmail.value = user.email || '';
      if (editPhone) editPhone.value = user.phone || '';
      if (editAvatar) editAvatar.value = user.avatar || '';
    }
  } catch (err) {
    console.error('Lỗi nạp thông tin user:', err);
  }
}

function setupForms() {
  // Update Profile Form
  const profileForm = document.getElementById('update-profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-name').value.trim();
      const phone = document.getElementById('edit-phone').value.trim();
      const avatar = document.getElementById('edit-avatar').value.trim();

      if (!name) {
        toast.warning('Vui lòng nhập họ tên.');
        return;
      }

      try {
        const res = await api.put('/auth/profile', { name, phone, avatar });
        if (res && res.success && res.user) {
          toast.success('Cập nhật thông tin thành công!');
          await loadUserData();
          initHeader();
        }
      } catch (err) {
        toast.error(err.message || 'Lỗi khi cập nhật thông tin.');
      }
    });
  }

  // Change Password Form
  const pwdForm = document.getElementById('change-pwd-form');
  if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmNewPassword = document.getElementById('confirm-new-password').value;

      if (!currentPassword || !newPassword) {
        toast.warning('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
        return;
      }

      if (newPassword.length < 6) {
        toast.warning('Mật khẩu mới phải có ít nhất 6 ký tự.');
        return;
      }

      if (newPassword !== confirmNewPassword) {
        toast.error('Xác nhận mật khẩu mới không khớp.');
        return;
      }

      try {
        const res = await api.put('/auth/change-password', {
          currentPassword,
          newPassword,
          confirmNewPassword
        });

        if (res && res.success) {
          toast.success('Đổi mật khẩu thành công!');
          pwdForm.reset();
        }
      } catch (err) {
        toast.error(err.message || 'Mật khẩu hiện tại không đúng.');
      }
    });
  }
}

async function loadMyReviews() {
  const container = document.getElementById('my-reviews-list');
  const badge = document.getElementById('my-reviews-total-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="py-8 text-center text-secondary text-xs flex items-center justify-center gap-2">
      <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
      <span>Đang tải danh sách đánh giá của bạn...</span>
    </div>
  `;

  try {
    const res = await api.get('/reviews/my');
    if (res && res.success && Array.isArray(res.data)) {
      container.innerHTML = '';
      if (badge) badge.textContent = `${res.data.length} đánh giá`;

      if (res.data.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center text-secondary text-xs bg-surface-container-low rounded-2xl">
            <span class="material-symbols-outlined text-3xl mb-1 text-secondary/40">rate_review</span>
            <p>Bạn chưa có đánh giá nào. Hãy trải nghiệm và chia sẻ nhận xét của bạn!</p>
          </div>
        `;
        return;
      }

      res.data.forEach(rev => {
        const item = document.createElement('div');
        item.className = 'p-4 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2.5';
        
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
          starsHtml += `<span class="material-symbols-outlined text-[15px] ${i <= rev.rating ? 'text-amber-500' : 'text-secondary/30'}" style="${i <= rev.rating ? "font-variation-settings: 'FILL' 1;" : ''}">star</span>`;
        }

        item.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-on-surface">${rev.restaurantName || 'Quán ăn'}</span>
              <div class="flex items-center">${starsHtml}</div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-secondary">${rev.date || 'Gần đây'}</span>
              <button class="del-review-btn text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer" data-id="${rev.id}">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
          <p class="text-xs text-on-surface-variant leading-relaxed">${rev.content}</p>
        `;

        item.querySelector('.del-review-btn').addEventListener('click', async () => {
          if (!confirm('Bạn có chắc muốn xóa đánh giá này?')) return;
          try {
            const delRes = await api.delete(`/reviews/${rev.id}`);
            if (delRes && delRes.success) {
              toast.success('Đã xóa đánh giá.');
              await loadMyReviews();
              await loadUserData();
            }
          } catch (e) {
            toast.error('Lỗi khi xóa đánh giá.');
          }
        });

        container.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Lỗi nạp đánh giá cá nhân:', err);
    container.innerHTML = `<div class="text-rose-500 text-xs py-4 text-center">Không thể nạp danh sách đánh giá.</div>`;
  }
}

