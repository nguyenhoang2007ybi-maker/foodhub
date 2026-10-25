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
  const tabAddressesBtn = document.getElementById('tab-addresses-btn');

  const panelInfo = document.getElementById('panel-info');
  const panelPassword = document.getElementById('panel-password');
  const panelMyReviews = document.getElementById('panel-my-reviews');
  const panelAddresses = document.getElementById('panel-addresses');

  const tabs = [
    { btn: tabInfoBtn, panel: panelInfo },
    { btn: tabPasswordBtn, panel: panelPassword },
    { btn: tabMyReviewsBtn, panel: panelMyReviews, onLoad: loadMyReviews },
    { btn: tabAddressesBtn, panel: panelAddresses, onLoad: loadUserAddresses }
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

        let statusBadge = '';
        if (rev.status === 'rejected') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Từ chối</span>';
        } else if (rev.status === 'hidden') {
          statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">Đã ẩn</span>';
        } else {
          statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Công khai</span>';
        }

        item.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-on-surface">${rev.restaurantName || 'Quán ăn'}</span>
              <div class="flex items-center">${starsHtml}</div>
              ${statusBadge}
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

// 4. Quản lý sổ địa chỉ giao hàng
async function loadUserAddresses() {
  const container = document.getElementById('addresses-list-container');
  if (!container) return;

  try {
    const res = await api.get('/auth/addresses');
    if (res && res.success && Array.isArray(res.data)) {
      renderAddressesList(res.data);
    }
  } catch (err) {
    console.error('Lỗi nạp sổ địa chỉ:', err);
    container.innerHTML = '<div class="text-rose-500 text-xs py-4 text-center">Không thể tải sổ địa chỉ.</div>';
  }

  setupAddressModal();
}

function renderAddressesList(addresses) {
  const container = document.getElementById('addresses-list-container');
  if (!container) return;

  if (addresses.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-secondary text-xs bg-surface-container-low rounded-2xl">
        <span class="material-symbols-outlined text-3xl mb-1 text-secondary/40">home_pin</span>
        <p>Bạn chưa lưu địa chỉ nhận hàng nào. Thêm địa chỉ để đặt món nhanh hơn!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  addresses.forEach(addr => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs';

    card.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <strong class="text-on-surface font-bold">${addr.recipientName}</strong>
          <span class="text-secondary">• ${addr.phone}</span>
          ${addr.isDefault ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">Mặc định</span>' : ''}
        </div>
        <p class="text-secondary leading-relaxed">${addr.fullAddress}</p>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
        ${!addr.isDefault ? `
          <button type="button" class="set-default-btn text-primary hover:underline text-[11px] font-semibold p-1 cursor-pointer" data-id="${addr.id}">
            Đặt mặc định
          </button>
        ` : ''}
        <button type="button" class="edit-addr-btn text-secondary hover:text-primary p-1 rounded hover:bg-surface-container-high transition-colors cursor-pointer" data-id="${addr.id}">
          <span class="material-symbols-outlined text-[18px]">edit</span>
        </button>
        <button type="button" class="del-addr-btn text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer" data-id="${addr.id}">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
    `;

    // Bind set default
    card.querySelector('.set-default-btn')?.addEventListener('click', async () => {
      try {
        await api.patch(`/auth/addresses/${addr.id}/default`);
        toast.success('Đã đặt làm địa chỉ mặc định!');
        await loadUserAddresses();
      } catch (e) {
        toast.error('Lỗi thiết lập mặc định.');
      }
    });

    // Bind edit
    card.querySelector('.edit-addr-btn')?.addEventListener('click', () => {
      openAddressModal(addr);
    });

    // Bind delete
    card.querySelector('.del-addr-btn')?.addEventListener('click', async () => {
      if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
      try {
        await api.delete(`/auth/addresses/${addr.id}`);
        toast.success('Đã xóa địa chỉ.');
        await loadUserAddresses();
      } catch (e) {
        toast.error('Lỗi khi xóa địa chỉ.');
      }
    });

    container.appendChild(card);
  });
}

function openAddressModal(addr = null) {
  const modal = document.getElementById('address-modal');
  const title = document.getElementById('address-modal-title');
  const idInput = document.getElementById('modal-address-id');
  const nameInput = document.getElementById('addr-modal-name');
  const phoneInput = document.getElementById('addr-modal-phone');
  const districtSelect = document.getElementById('addr-modal-district');
  const wardInput = document.getElementById('addr-modal-ward');
  const streetInput = document.getElementById('addr-modal-street');
  const defaultCheckbox = document.getElementById('addr-modal-default');

  if (addr) {
    if (title) title.textContent = 'Chỉnh sửa địa chỉ nhận hàng';
    if (idInput) idInput.value = addr.id;
    if (nameInput) nameInput.value = addr.recipientName;
    if (phoneInput) phoneInput.value = addr.phone;
    if (districtSelect) districtSelect.value = addr.district || '';
    if (wardInput) wardInput.value = addr.ward || '';
    if (streetInput) streetInput.value = addr.street || '';
    if (defaultCheckbox) defaultCheckbox.checked = Boolean(addr.isDefault);
  } else {
    if (title) title.textContent = 'Thêm địa chỉ nhận hàng';
    if (idInput) idInput.value = '';
    const user = getUser();
    if (nameInput) nameInput.value = user?.name || '';
    if (phoneInput) phoneInput.value = user?.phone || '';
    if (districtSelect) districtSelect.value = '';
    if (wardInput) wardInput.value = '';
    if (streetInput) streetInput.value = '';
    if (defaultCheckbox) defaultCheckbox.checked = false;
  }

  modal?.classList.remove('hidden');
}

let addressModalInitialized = false;
function setupAddressModal() {
  if (addressModalInitialized) return;
  addressModalInitialized = true;

  const modal = document.getElementById('address-modal');
  const openBtn = document.getElementById('open-add-address-btn');
  const closeBtn = document.getElementById('close-address-modal-btn');
  const cancelBtn = document.getElementById('cancel-addr-modal-btn');
  const form = document.getElementById('address-form');

  const closeModal = () => modal?.classList.add('hidden');

  openBtn?.addEventListener('click', () => openAddressModal(null));
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('modal-address-id')?.value;
    const recipientName = document.getElementById('addr-modal-name')?.value.trim();
    const phone = document.getElementById('addr-modal-phone')?.value.trim();
    const province = document.getElementById('addr-modal-province')?.value.trim() || 'Hà Nội';
    const district = document.getElementById('addr-modal-district')?.value.trim();
    const ward = document.getElementById('addr-modal-ward')?.value.trim();
    const street = document.getElementById('addr-modal-street')?.value.trim();
    const isDefault = document.getElementById('addr-modal-default')?.checked;

    const VN_PHONE_REGEX = /^(?:\+?84|0)(3[2-9]|5[5-9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (!VN_PHONE_REGEX.test(phone)) {
      toast.error('Số điện thoại không đúng chuẩn di động Việt Nam (10 số, đầu 03x, 05x, 07x, 08x, 09x).');
      return;
    }

    try {
      const res = await api.post('/auth/addresses', {
        id: id ? Number(id) : undefined,
        recipientName,
        phone,
        province,
        district,
        ward,
        street,
        isDefault
      });

      if (res && res.success) {
        toast.success(res.message || 'Lưu địa chỉ thành công!');
        closeModal();
        await loadUserAddresses();
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu địa chỉ.');
    }
  });
}

