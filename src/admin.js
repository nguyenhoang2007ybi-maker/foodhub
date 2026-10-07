// FoodHub Admin Dashboard Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { requireAdmin, getUser, logout } from './auth.js';

let cachedCategories = [];
let cachedRestaurants = [];

// Trạng thái chỉnh sửa giờ trong phiên mở modal
let hoursTouched = false;
// true nếu quán cũ có openingHours nhiều khung giờ (không thể biểu diễn bằng 2 dropdown)
let keepLegacyHours = false;

const HANOI_AREAS = [
  'Cầu Giấy', 'Dịch Vọng', 'Dịch Vọng Hậu', 'Yên Hòa', 'Trung Hòa',
  'Mỹ Đình', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Thanh Xuân', 'Đống Đa',
  'Ba Đình', 'Hoàn Kiếm', 'Hai Bà Trưng', 'Hà Đông', 'Long Biên',
  'Tây Hồ', 'Hoàng Mai', 'Gia Lâm', 'Đông Anh', 'Sóc Sơn'
];

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

const DEFAULT_OPEN_TIME = '07:00';
const DEFAULT_CLOSE_TIME = '22:00';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chuẩn hóa chuỗi giờ về định dạng HH:MM hợp lệ (bước 30 phút), trả về null nếu không hợp lệ
function normalizeTime(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${min >= 30 ? '30' : '00'}`;
}

// Đọc giờ mở/đóng cửa từ dữ liệu mới (openingTime/closingTime) hoặc dữ liệu cũ (openingHours)
function parseOpeningHours(restaurant) {
  if (!restaurant) return null;

  const open = normalizeTime(restaurant.openingTime);
  const close = normalizeTime(restaurant.closingTime);
  if (open && close) return { open, close };

  const match = String(restaurant.openingHours || '').match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
  if (match) {
    const o = normalizeTime(match[1]);
    const c = normalizeTime(match[2]);
    if (o && c) return { open: o, close: c };
  }
  return null;
}

function is24Hours(restaurant) {
  if (!restaurant) return false;
  return restaurant.open24 === true || /24\s*\/\s*24/i.test(String(restaurant.openingHours || ''));
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAdmin()) return;

  initAdminHeader();
  setupNavigation();
  await loadDashboardStats();
});

function initAdminHeader() {
  const user = getUser();
  const avatar = document.getElementById('admin-top-avatar');
  const name = document.getElementById('admin-top-name');
  const logoutBtn = document.getElementById('admin-logout-btn');

  if (avatar) avatar.src = (user && user.avatar) || 'https://ui-avatars.com/api/?name=Admin&background=ff6b35&color=fff';
  if (name) name.textContent = (user && user.name) || 'Admin';

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

function setupNavigation() {
  const navDashboard = document.getElementById('nav-dashboard');
  const navRestaurants = document.getElementById('nav-restaurants');
  const navCategories = document.getElementById('nav-categories');
  const navUsers = document.getElementById('nav-users');
  const navReviews = document.getElementById('nav-reviews');

  const secDashboard = document.getElementById('section-dashboard');
  const secRestaurants = document.getElementById('section-restaurants');
  const secCategories = document.getElementById('section-categories');
  const secUsers = document.getElementById('section-users');
  const secReviews = document.getElementById('section-reviews');

  const tabs = [
    { btn: navDashboard, sec: secDashboard, load: loadDashboardStats },
    { btn: navRestaurants, sec: secRestaurants, load: loadRestaurantsManager },
    { btn: navCategories, sec: secCategories, load: loadCategoriesManager },
    { btn: navUsers, sec: secUsers, load: loadUsersManager },
    { btn: navReviews, sec: secReviews, load: loadReviewsManager }
  ];

  tabs.forEach(({ btn, sec, load }) => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-low transition-all text-left';
        t.sec.classList.add('hidden');
      });

      btn.className = 'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all bg-primary-container text-on-primary shadow-sm text-left';
      sec.classList.remove('hidden');

      if (load) load();
    });
  });
}

// ==========================================
// 1. DASHBOARD
// ==========================================
async function loadDashboardStats() {
  try {
    const res = await api.get('/admin/stats');
    if (!res || !res.success || !res.data) return;

    const stats = res.data;

    document.getElementById('stat-total-users').textContent = stats.totalUsers || 0;
    document.getElementById('stat-total-restaurants').textContent = stats.totalRestaurants || 0;
    document.getElementById('stat-total-reviews').textContent = stats.totalReviews || 0;
    document.getElementById('stat-total-categories').textContent = stats.totalCategories || 0;

    // Rating breakdown bars
    const ratingBars = document.getElementById('rating-bars-container');
    if (ratingBars && stats.ratingDistribution) {
      ratingBars.innerHTML = '';
      const totalReviews = stats.totalReviews || 1;

      for (let star = 5; star >= 1; star--) {
        const count = stats.ratingDistribution[star] || 0;
        const pct = Math.round((count / totalReviews) * 100);

        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 text-xs';
        row.innerHTML = `
          <span class="w-12 font-bold text-on-surface flex items-center gap-0.5">
            <span>${star}</span>
            <span class="material-symbols-outlined text-[14px] text-amber-500" style="font-variation-settings: 'FILL' 1;">star</span>
          </span>
          <div class="flex-1 h-3 rounded-full bg-surface-container-low overflow-hidden">
            <div class="h-full bg-amber-400 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
          <span class="w-14 text-right text-secondary font-medium">${count} (${pct}%)</span>
        `;
        ratingBars.appendChild(row);
      }
    }

    // Top Restaurants
    const topList = document.getElementById('top-restaurants-list');
    if (topList && Array.isArray(stats.topRestaurants)) {
      topList.innerHTML = '';
      stats.topRestaurants.forEach((r, idx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-container-low transition-colors';
        item.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-lg bg-surface-container-high flex items-center justify-center font-bold text-xs text-secondary">${idx + 1}</span>
            <img src="${r.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=100&q=80'}" class="w-10 h-10 rounded-lg object-cover" />
            <div>
              <h4 class="font-bold text-xs text-on-surface">${r.name}</h4>
              <p class="text-[11px] text-secondary">${r.category}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 font-bold text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
            <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span>${Number(r.rating || 0).toFixed(1)}</span>
          </div>
        `;
        topList.appendChild(item);
      });
    }

    // Recent reviews
    const recentTable = document.getElementById('recent-reviews-table');
    if (recentTable && Array.isArray(stats.recentReviews)) {
      recentTable.innerHTML = `
        <table class="w-full text-left text-xs">
          <thead class="text-secondary border-b border-surface-container text-[11px] uppercase">
            <tr>
              <th class="py-2.5 px-3">Quán ăn</th>
              <th class="py-2.5 px-3">Người dùng</th>
              <th class="py-2.5 px-3">Đánh giá</th>
              <th class="py-2.5 px-3">Nội dung</th>
              <th class="py-2.5 px-3">Ngày</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-container">
            ${stats.recentReviews.map(rev => `
              <tr>
                <td class="py-3 px-3 font-bold text-on-surface">${rev.restaurantName}</td>
                <td class="py-3 px-3">${rev.userName}</td>
                <td class="py-3 px-3">
                  <span class="inline-flex items-center gap-0.5 text-amber-600 font-bold">
                    <span>${rev.rating}</span>
                    <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">star</span>
                  </span>
                </td>
                <td class="py-3 px-3 text-secondary truncate max-w-xs">${rev.content}</td>
                <td class="py-3 px-3 text-secondary text-[11px]">${rev.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

  } catch (err) {
    console.error('Lỗi nạp thống kê admin:', err);
  }
}

// ==========================================
// 2. RESTAURANTS MANAGEMENT
// ==========================================
async function loadRestaurantsManager() {
  const tbody = document.getElementById('admin-rest-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-secondary">Đang tải danh sách quán ăn...</td></tr>`;

  try {
    // Also load categories for modal select
    const catRes = await api.get('/categories');
    if (catRes && catRes.success) {
      cachedCategories = catRes.data;
      const modalCatSelect = document.getElementById('modal-rest-category');
      if (modalCatSelect) {
        modalCatSelect.innerHTML = cachedCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      }
    }

    const res = await api.get('/restaurants?limit=100');
    if (res && res.success && Array.isArray(res.data)) {
      cachedRestaurants = res.data;
      renderRestaurantsTable(cachedRestaurants);
    }
  } catch (err) {
    console.error('Lỗi nạp quán ăn admin:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500">Lỗi khi tải quán ăn.</td></tr>`;
  }

  // Bind Search Filter
  const searchInput = document.getElementById('admin-search-rest');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = cachedRestaurants.filter(r => r.name.toLowerCase().includes(q) || (r.address && r.address.toLowerCase().includes(q)));
      renderRestaurantsTable(filtered);
    };
  }

  // Bind Add Restaurant
  const addBtn = document.getElementById('add-restaurant-btn');
  if (addBtn) {
    addBtn.onclick = () => openRestaurantModal();
  }

  setupRestaurantModalEvents();
}

function renderRestaurantsTable(list) {
  const tbody = document.getElementById('admin-rest-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-secondary">Không có quán ăn nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';
    tr.innerHTML = `
      <td class="p-4">
        <div class="flex items-center gap-3">
          <img src="${r.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=100&q=80'}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          <div>
            <h4 class="font-bold text-xs text-on-surface">${r.name}</h4>
            <p class="text-[11px] text-secondary truncate max-w-xs">${r.address}</p>
          </div>
        </div>
      </td>
      <td class="p-4">
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-container/15 text-primary">${r.category}</span>
        <span class="block text-[11px] text-secondary mt-1">${r.area || 'Hà Nội'}</span>
      </td>
      <td class="p-4 font-bold text-primary text-[11px]">${r.price || 'Liên hệ'}</td>
      <td class="p-4">
        <div class="flex items-center gap-1 font-bold text-xs text-amber-600">
          <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
          <span>${Number(r.rating || 0).toFixed(1)}</span>
          <span class="text-secondary font-normal text-[11px]">(${r.reviewsCount || 0})</span>
        </div>
      </td>
      <td class="p-4 text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="edit-rest-btn p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-primary-container/10 transition-colors" data-id="${r.id}" title="Sửa">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button class="del-rest-btn p-1.5 rounded-lg text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors" data-id="${r.id}" title="Xóa">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;

    tr.querySelector('.edit-rest-btn').onclick = () => openRestaurantModal(r);
    tr.querySelector('.del-rest-btn').onclick = () => deleteRestaurant(r.id, r.name);

    tbody.appendChild(tr);
  });
}

function populateTimeSelects() {
  const openSel = document.getElementById('modal-rest-open-time');
  const closeSel = document.getElementById('modal-rest-close-time');
  if (!openSel || !closeSel) return;

  const options = TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
  openSel.innerHTML = options;
  closeSel.innerHTML = `<option value="">-- Chọn giờ đóng cửa --</option>${options}`;
}

function syncPresetWithTimes() {
  const presetSel = document.getElementById('modal-rest-hours-preset');
  const openSel = document.getElementById('modal-rest-open-time');
  const closeSel = document.getElementById('modal-rest-close-time');
  if (!presetSel || !openSel || !closeSel) return;

  closeSel.disabled = false;
  const key = `${openSel.value}-${closeSel.value}`;
  const matched = Array.from(presetSel.options).some(o => o.value === key && o.value !== '');
  presetSel.value = matched ? key : '';
}

function setupHoursControls() {
  const presetSel = document.getElementById('modal-rest-hours-preset');
  const openSel = document.getElementById('modal-rest-open-time');
  const closeSel = document.getElementById('modal-rest-close-time');
  if (!presetSel || !openSel || !closeSel) return;

  presetSel.onchange = () => {
    hoursTouched = true;
    const value = presetSel.value;
    if (value === '24') {
      openSel.value = '00:00';
      closeSel.value = '';
      closeSel.disabled = true;
      return;
    }
    closeSel.disabled = false;
    if (value && value.includes('-')) {
      const [open, close] = value.split('-');
      openSel.value = open;
      closeSel.value = close;
    }
  };

  openSel.onchange = () => { hoursTouched = true; syncPresetWithTimes(); };
  closeSel.onchange = () => { hoursTouched = true; syncPresetWithTimes(); };
}

function applyHoursToForm(restaurant = null) {
  const presetSel = document.getElementById('modal-rest-hours-preset');
  const openSel = document.getElementById('modal-rest-open-time');
  const closeSel = document.getElementById('modal-rest-close-time');
  const hint = document.getElementById('modal-rest-hours-hint');
  if (!presetSel || !openSel || !closeSel) return;

  keepLegacyHours = false;
  if (hint) {
    hint.classList.add('hidden');
    hint.textContent = '';
  }

  closeSel.disabled = false;
  presetSel.value = '';
  openSel.value = DEFAULT_OPEN_TIME;
  closeSel.value = DEFAULT_CLOSE_TIME;

  if (!restaurant) return;

  if (is24Hours(restaurant)) {
    openSel.value = '00:00';
    closeSel.value = '';
    closeSel.disabled = true;
    presetSel.value = '24';
    return;
  }

  const parsed = parseOpeningHours(restaurant);
  if (parsed) {
    if (TIME_SLOTS.includes(parsed.open)) openSel.value = parsed.open;
    if (TIME_SLOTS.includes(parsed.close)) closeSel.value = parsed.close;
  }

  const key = `${openSel.value}-${closeSel.value}`;
  if (Array.from(presetSel.options).some(o => o.value === key && o.value !== '')) {
    presetSel.value = key;
  }

  // Quán cũ có openingHours nhiều khung giờ (vd: "06:00 - 10:00 & 18:00 - 20:30"):
  // giữ nguyên chuỗi cũ nếu Admin không chủ động đổi giờ.
  const legacy = String(restaurant.openingHours || '').trim();
  const isSimpleRange = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.test(legacy);
  if (legacy && !restaurant.openingTime && !isSimpleRange) {
    keepLegacyHours = true;
    if (hint) {
      hint.textContent = `Dữ liệu cũ đang lưu: "${legacy}". Nếu bạn không đổi giờ ở trên, chuỗi giờ này sẽ được giữ nguyên.`;
      hint.classList.remove('hidden');
    }
  }
}

function setupAreaCombobox() {
  const input = document.getElementById('modal-rest-area');
  const list = document.getElementById('modal-rest-area-list');
  if (!input || !list) return;

  const hide = () => {
    list.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
  };

  const render = () => {
    const keyword = input.value.trim().toLowerCase();
    const matches = HANOI_AREAS.filter(a => !keyword || a.toLowerCase().includes(keyword));
    const current = input.value.trim();

    if (current && !HANOI_AREAS.some(a => a.toLowerCase() === current.toLowerCase()) &&
        (!keyword || current.toLowerCase().includes(keyword))) {
      matches.unshift(current);
    }

    list.innerHTML = matches.length
      ? matches.map(a => `<button type="button" class="area-option w-full text-left px-3 py-2 rounded-lg text-xs text-on-surface hover:bg-surface-container-low transition-colors" data-area="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')
      : `<div class="px-3 py-2 text-[11px] text-secondary">Không tìm thấy khu vực phù hợp</div>`;

    list.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  };

  input.onfocus = render;
  input.oninput = render;
  input.onblur = () => setTimeout(hide, 120);
  input.onkeydown = (e) => { if (e.key === 'Escape') hide(); };

  list.onmousedown = (e) => {
    const option = e.target.closest('.area-option');
    if (!option) return;
    e.preventDefault();
    input.value = option.dataset.area || '';
    hide();
  };
}

function openRestaurantModal(restaurant = null) {
  const modal = document.getElementById('rest-modal');
  const title = document.getElementById('rest-modal-title');
  const idInput = document.getElementById('modal-rest-id');
  const nameInput = document.getElementById('modal-rest-name');
  const catInput = document.getElementById('modal-rest-category');
  const addrInput = document.getElementById('modal-rest-address');
  const areaInput = document.getElementById('modal-rest-area');
  const priceInput = document.getElementById('modal-rest-price');
  const phoneInput = document.getElementById('modal-rest-phone');
  const imgInput = document.getElementById('modal-rest-image');
  const descInput = document.getElementById('modal-rest-desc');

  populateTimeSelects();
  setupHoursControls();
  setupAreaCombobox();
  hoursTouched = false;

  if (restaurant) {
    title.textContent = `Chỉnh sửa: ${restaurant.name}`;
    idInput.value = restaurant.id;
    nameInput.value = restaurant.name || '';
    if (catInput) catInput.value = restaurant.category || '';
    addrInput.value = restaurant.address || '';
    areaInput.value = restaurant.area || '';
    priceInput.value = restaurant.price || '';
    phoneInput.value = restaurant.phone || '';
    imgInput.value = restaurant.image || '';
    descInput.value = restaurant.description || '';
    applyHoursToForm(restaurant);
  } else {
    title.textContent = 'Thêm Quán Ăn Mới';
    idInput.value = '';
    nameInput.value = '';
    if (catInput && catInput.options.length) catInput.selectedIndex = 0;
    addrInput.value = '';
    areaInput.value = 'Hoàn Kiếm';
    priceInput.value = '50.000đ - 100.000đ';
    phoneInput.value = '0901234567';
    imgInput.value = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80';
    descInput.value = '';
    applyHoursToForm(null);
  }

  modal.classList.remove('hidden');
}

function setupRestaurantModalEvents() {
  const modal = document.getElementById('rest-modal');
  const closeBtn = document.getElementById('close-rest-modal');
  const cancelBtn = document.getElementById('cancel-rest-modal');
  const form = document.getElementById('rest-modal-form');

  const close = () => modal.classList.add('hidden');
  if (closeBtn) closeBtn.onclick = close;
  if (cancelBtn) cancelBtn.onclick = close;

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('modal-rest-id').value;

      const openTime = document.getElementById('modal-rest-open-time').value;
      const closeTime = document.getElementById('modal-rest-close-time').value;
      const presetValue = document.getElementById('modal-rest-hours-preset').value;
      const open24 = presetValue === '24';

      // Quán cũ có nhiều khung giờ và Admin không đổi giờ -> giữ nguyên openingHours cũ
      const preserveLegacyHours = keepLegacyHours && !hoursTouched;

      if (!preserveLegacyHours) {
        if (!open24 && !closeTime) {
          toast.error('Vui lòng chọn giờ đóng cửa hoặc chọn "Mở cửa 24/24".');
          return;
        }
        if (!open24 && closeTime === openTime) {
          toast.error('Giờ đóng cửa phải khác giờ mở cửa.');
          return;
        }
      }

      const payload = {
        name: document.getElementById('modal-rest-name').value.trim(),
        category: document.getElementById('modal-rest-category').value,
        address: document.getElementById('modal-rest-address').value.trim(),
        area: document.getElementById('modal-rest-area').value.trim(),
        price: document.getElementById('modal-rest-price').value.trim(),
        phone: document.getElementById('modal-rest-phone').value.trim(),
        image: document.getElementById('modal-rest-image').value.trim(),
        description: document.getElementById('modal-rest-desc').value.trim()
      };

      if (!preserveLegacyHours) {
        payload.openingTime = open24 ? '00:00' : openTime;
        payload.closingTime = open24 ? null : closeTime;
        payload.open24 = open24;
        payload.openingHours = open24 ? 'Mở cửa 24/24' : `${openTime} - ${closeTime}`;
      }

      try {
        let res;
        if (id) {
          res = await api.put(`/restaurants/${id}`, payload);
        } else {
          res = await api.post('/restaurants', payload);
        }

        if (res && res.success) {
          toast.success(res.message || 'Lưu thông tin quán ăn thành công!');
          close();
          await loadRestaurantsManager();
        }
      } catch (err) {
        toast.error(err.message || 'Lỗi khi lưu quán ăn.');
      }
    };
  }
}

async function deleteRestaurant(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa quán ăn "${name}"? Thao tác này không thể hoàn tác!`)) return;

  try {
    const res = await api.delete(`/restaurants/${id}`);
    if (res && res.success) {
      toast.success(res.message || 'Đã xóa quán ăn thành công.');
      await loadRestaurantsManager();
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi xóa quán ăn.');
  }
}

// ==========================================
// 3. CATEGORIES MANAGEMENT
// ==========================================
async function loadCategoriesManager() {
  const tbody = document.getElementById('admin-cat-tbody');
  const addBtn = document.getElementById('add-category-btn');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-secondary">Đang tải danh mục...</td></tr>`;

  try {
    const res = await api.get('/categories');
    if (res && res.success && Array.isArray(res.data)) {
      cachedCategories = res.data;
      renderCategoriesTable(cachedCategories);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-rose-500">Lỗi nạp danh mục.</td></tr>`;
  }

  if (addBtn) {
    addBtn.onclick = () => {
      const name = prompt('Nhập tên danh mục mới:');
      if (!name || !name.trim()) return;
      const description = prompt('Nhập mô tả danh mục (tùy chọn):') || '';

      api.post('/categories', { name: name.trim(), description: description.trim() })
        .then(res => {
          if (res && res.success) {
            toast.success('Thêm danh mục thành công!');
            loadCategoriesManager();
          }
        })
        .catch(err => toast.error(err.message || 'Lỗi khi thêm danh mục.'));
    };
  }
}

function renderCategoriesTable(list) {
  const tbody = document.getElementById('admin-cat-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';
    tr.innerHTML = `
      <td class="p-4 font-bold text-on-surface">${c.name}</td>
      <td class="p-4 text-secondary">${c.description || 'Không có mô tả'}</td>
      <td class="p-4 text-center font-bold text-primary">${c.count || 0} quán</td>
      <td class="p-4 text-right">
        <button class="del-cat-btn text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" data-id="${c.id}" title="Xóa">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </td>
    `;

    tr.querySelector('.del-cat-btn').onclick = async () => {
      if (!confirm(`Bạn có chắc muốn xóa danh mục "${c.name}"?`)) return;
      try {
        const res = await api.delete(`/categories/${c.id}`);
        if (res && res.success) {
          toast.success('Đã xóa danh mục.');
          loadCategoriesManager();
        }
      } catch (e) {
        toast.error(e.message || 'Lỗi xóa danh mục.');
      }
    };

    tbody.appendChild(tr);
  });
}

// ==========================================
// 4. USERS MANAGEMENT
// ==========================================
async function loadUsersManager() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-secondary">Đang tải danh sách người dùng...</td></tr>`;

  try {
    const res = await api.get('/admin/users');
    if (res && res.success && Array.isArray(res.data)) {
      renderUsersTable(res.data);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500">Lỗi nạp người dùng.</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('admin-users-tbody');
  const me = getUser();
  if (!tbody) return;

  tbody.innerHTML = '';
  users.forEach(u => {
    const isMe = me && me.id === u.id;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    tr.innerHTML = `
      <td class="p-4">
        <div class="flex items-center gap-3">
          <img src="${u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=ff6b35&color=fff`}" class="w-10 h-10 rounded-full object-cover" />
          <div>
            <span class="font-bold text-on-surface">${u.name} ${isMe ? '<span class="text-[10px] text-primary">(Bạn)</span>' : ''}</span>
            <span class="block text-[11px] text-secondary">ID: ${u.id}</span>
          </div>
        </div>
      </td>
      <td class="p-4">
        <span class="font-medium text-on-surface">${u.email}</span>
        <span class="block text-[11px] text-secondary">${u.phone || 'Chưa cập nhật'}</span>
      </td>
      <td class="p-4">
        <select class="user-role-select bg-surface-container-low border border-surface-container rounded-lg px-2 py-1 text-xs font-semibold ${u.role === 'admin' ? 'text-amber-800 bg-amber-50' : 'text-primary'}" data-id="${u.id}" ${isMe ? 'disabled title="Không thể tự hạ quyền của chính bạn"' : ''}>
          <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>Khách hàng</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
        </select>
      </td>
      <td class="p-4">
        <select class="user-status-select bg-surface-container-low border border-surface-container rounded-lg px-2 py-1 text-xs font-semibold ${u.status === 'blocked' ? 'text-rose-600 bg-rose-50' : 'text-emerald-700 bg-emerald-50'}" data-id="${u.id}" ${isMe ? 'disabled title="Không thể tự khóa tài khoản của chính bạn"' : ''}>
          <option value="active" ${u.status === 'active' ? 'selected' : ''}>Đang hoạt động</option>
          <option value="blocked" ${u.status === 'blocked' ? 'selected' : ''}>Đã bị khóa</option>
        </select>
      </td>
      <td class="p-4 text-right">
        ${isMe ? '<span class="text-secondary text-[11px]">Đang đăng nhập</span>' : (u.role === 'admin' ? `
          <button class="del-user-btn text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" data-id="${u.id}" title="Xóa tài khoản">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        ` : '<span class="text-secondary text-[11px]">Không thể xóa</span>')}
      </td>
    `;

    // Role change
    const roleSelect = tr.querySelector('.user-role-select');
    if (roleSelect && !isMe) {
      roleSelect.onchange = async (e) => {
        try {
          const res = await api.put(`/admin/users/${u.id}`, { role: e.target.value });
          if (res && res.success) toast.success('Cập nhật quyền thành công!');
        } catch (err) {
          toast.error(err.message || 'Lỗi cập nhật quyền.');
          loadUsersManager();
        }
      };
    }

    // Status change
    const statusSelect = tr.querySelector('.user-status-select');
    if (statusSelect && !isMe) {
      statusSelect.onchange = async (e) => {
        try {
          const res = await api.put(`/admin/users/${u.id}`, { status: e.target.value });
          if (res && res.success) toast.success('Cập nhật trạng thái thành công!');
        } catch (err) {
          toast.error(err.message || 'Lỗi cập nhật trạng thái.');
          loadUsersManager();
        }
      };
    }

    // Delete user (chỉ dành cho tài khoản quản trị viên, KHÔNG cho xóa tài khoản khách hàng)
    const delBtn = tr.querySelector('.del-user-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!isMe && u.role === 'admin') {
          if (!confirm(`Bạn có chắc muốn xóa tài khoản "${u.name}" (${u.email})?`)) return;
          try {
            const res = await api.delete(`/admin/users/${u.id}`);
            if (res && res.success) {
              toast.success('Đã xóa tài khoản.');
              loadUsersManager();
            }
          } catch (err) {
            toast.error(err.message || 'Lỗi khi xóa người dùng.');
          }
        } else {
          toast.error('Không thể xóa tài khoản khách hàng.');
        }
      };
    }

    tbody.appendChild(tr);
  });
}

// ==========================================
// 5. REVIEWS MODERATION
// ==========================================
async function loadReviewsManager() {
  const tbody = document.getElementById('admin-reviews-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-secondary">Đang tải danh sách đánh giá...</td></tr>`;

  try {
    const res = await api.get('/reviews/admin/all');
    if (res && res.success && Array.isArray(res.data)) {
      renderReviewsTable(res.data);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-500">Lỗi nạp đánh giá.</td></tr>`;
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('admin-reviews-tbody');
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-secondary">Không có đánh giá nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  reviews.forEach(rev => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    tr.innerHTML = `
      <td class="p-4 font-bold text-on-surface">${rev.restaurantName || 'Quán ăn'}</td>
      <td class="p-4">${rev.userName}</td>
      <td class="p-4">
        <span class="inline-flex items-center gap-0.5 text-amber-600 font-bold">
          <span>${rev.rating}</span>
          <span class="material-symbols-outlined text-[13px]" style="font-variation-settings: 'FILL' 1;">star</span>
        </span>
      </td>
      <td class="p-4 text-secondary max-w-sm truncate">${rev.content}</td>
      <td class="p-4">
        <select class="rev-status-select bg-surface-container-low border border-surface-container rounded-lg px-2 py-1 text-xs font-semibold ${rev.status === 'approved' ? 'text-emerald-700 bg-emerald-50' : (rev.status === 'pending' ? 'text-amber-800 bg-amber-50' : 'text-secondary')}" data-id="${rev.id}">
          <option value="approved" ${rev.status === 'approved' ? 'selected' : ''}>Đã duyệt</option>
          <option value="pending" ${rev.status === 'pending' ? 'selected' : ''}>Chờ duyệt</option>
          <option value="hidden" ${rev.status === 'hidden' ? 'selected' : ''}>Đã ẩn</option>
        </select>
      </td>
      <td class="p-4 text-right">
        <button class="del-review-btn text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" data-id="${rev.id}" title="Xóa nhận xét">
          <span class="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </td>
    `;

    // Status change
    const statusSelect = tr.querySelector('.rev-status-select');
    statusSelect.onchange = async (e) => {
      try {
        const res = await api.patch(`/reviews/${rev.id}/status`, { status: e.target.value });
        if (res && res.success) toast.success(`Đã cập nhật trạng thái: ${e.target.value}`);
      } catch (err) {
        toast.error('Lỗi khi cập nhật trạng thái nhận xét.');
        loadReviewsManager();
      }
    };

    // Delete review
    const delBtn = tr.querySelector('.del-review-btn');
    delBtn.onclick = async () => {
      if (!confirm('Bạn có chắc muốn xóa vĩnh viễn đánh giá này?')) return;
      try {
        const res = await api.delete(`/reviews/${rev.id}`);
        if (res && res.success) {
          toast.success('Đã xóa đánh giá thành công.');
          loadReviewsManager();
        }
      } catch (err) {
        toast.error('Lỗi xóa đánh giá.');
      }
    };

    tbody.appendChild(tr);
  });
}
