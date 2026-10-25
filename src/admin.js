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
  const navOrders = document.getElementById('nav-orders');
  const navCoupons = document.getElementById('nav-coupons');

  const secDashboard = document.getElementById('section-dashboard');
  const secRestaurants = document.getElementById('section-restaurants');
  const secCategories = document.getElementById('section-categories');
  const secUsers = document.getElementById('section-users');
  const secReviews = document.getElementById('section-reviews');
  const secOrders = document.getElementById('section-orders');
  const secCoupons = document.getElementById('section-coupons');

  const tabs = [
    { btn: navDashboard, sec: secDashboard, load: loadDashboardStats },
    { btn: navRestaurants, sec: secRestaurants, load: loadRestaurantsManager },
    { btn: navCategories, sec: secCategories, load: loadCategoriesManager },
    { btn: navUsers, sec: secUsers, load: loadUsersManager },
    { btn: navReviews, sec: secReviews, load: loadReviewsManager },
    { btn: navOrders, sec: secOrders, load: loadOrdersManager },
    { btn: navCoupons, sec: secCoupons, load: loadCouponsManager }
  ];

  tabs.forEach(({ btn, sec, load }) => {
    btn?.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.className = 'w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-low transition-all text-left';
        t.sec.classList.add('hidden');
      });

      btn.className = 'w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all bg-primary-container text-on-primary shadow-sm text-left';
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

    const navPendingBadge = document.getElementById('nav-pending-badge');
    if (navPendingBadge) {
      if (stats.pendingReviews > 0) {
        navPendingBadge.textContent = stats.pendingReviews;
        navPendingBadge.classList.remove('hidden');
      } else {
        navPendingBadge.classList.add('hidden');
      }
    }

    // Tải thống kê đơn hàng để cập nhật badge sidebar
    try {
      const orderStatsRes = await api.get('/orders/admin/stats');
      if (orderStatsRes && orderStatsRes.success && orderStatsRes.data) {
        const orderBadge = document.getElementById('nav-orders-badge');
        if (orderBadge) {
          if (orderStatsRes.data.pending > 0) {
            orderBadge.textContent = orderStatsRes.data.pending;
            orderBadge.classList.remove('hidden');
          } else {
            orderBadge.classList.add('hidden');
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy thống kê đơn cho badge:', e);
    }

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
  setupMenuModalEventsOnce();
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
    const dishCount = Array.isArray(r.menu) ? r.menu.length : 0;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';
    tr.innerHTML = `
      <td class="p-4">
        <div class="flex items-center gap-3">
          <img src="${r.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=100&q=80'}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          <div class="min-w-0">
            <h4 class="font-bold text-xs text-on-surface truncate">${escapeHtml(r.name)}</h4>
            <p class="text-[11px] text-secondary truncate max-w-xs flex items-center gap-1 mt-0.5" title="${escapeHtml(r.address)}">
              <span class="material-symbols-outlined text-[13px] text-primary flex-shrink-0">location_on</span>
              <span class="truncate">${escapeHtml(r.address)}</span>
            </p>
            <div class="flex items-center gap-1.5 flex-wrap mt-1">
              ${r.mapUrl ? `
                <span class="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold" title="Đã có link Google Maps riêng">
                  <span class="material-symbols-outlined text-[12px]">map</span>
                  <span>Bản đồ riêng</span>
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 text-[10px] text-secondary bg-surface-container-low px-1.5 py-0.5 rounded font-medium" title="Bản đồ tự động theo tên và địa chỉ">
                  <span class="material-symbols-outlined text-[12px]">explore</span>
                  <span>Bản đồ tự động</span>
                </span>
              `}
              <span class="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-semibold" title="Số lượng món ăn trong thực đơn">
                <span class="material-symbols-outlined text-[12px]">restaurant_menu</span>
                <span>${dishCount} món</span>
              </span>
            </div>
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
          <a href="/restaurant-detail.html?id=${r.id}" target="_blank" class="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-primary-container/10 transition-colors" title="Xem chi tiết & bản đồ quán trên website">
            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>
          <button class="menu-rest-btn p-1.5 rounded-lg text-secondary hover:text-amber-600 hover:bg-amber-50 transition-colors" data-id="${r.id}" title="Quản lý thực đơn (${dishCount} món)">
            <span class="material-symbols-outlined text-[18px]">restaurant_menu</span>
          </button>
          <button class="edit-rest-btn p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-primary-container/10 transition-colors" data-id="${r.id}" title="Sửa thông tin & vị trí bản đồ">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button class="del-rest-btn p-1.5 rounded-lg text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors" data-id="${r.id}" title="Xóa quán">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;

    tr.querySelector('.menu-rest-btn').onclick = () => openRestaurantMenuModal(r);
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
  const mapUrlInput = document.getElementById('modal-rest-map-url');

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
    if (mapUrlInput) mapUrlInput.value = restaurant.mapUrl || '';
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
    if (mapUrlInput) mapUrlInput.value = '';
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
        description: document.getElementById('modal-rest-desc').value.trim(),
        mapUrl: (document.getElementById('modal-rest-map-url')?.value || '').trim()
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
// 2.1 QUẢN LÝ THỰC ĐƠN QUÁN ĂN (MENU MODAL)
// ==========================================
let currentMenuRestaurant = null;
let currentMenuList = [];
let menuModalEventsBound = false;

function setupMenuModalEventsOnce() {
  if (menuModalEventsBound) return;
  menuModalEventsBound = true;

  const modal = document.getElementById('admin-menu-modal');
  const closeBtn = document.getElementById('admin-menu-modal-close');
  const addDishBtn = document.getElementById('admin-menu-add-dish-btn');
  const cancelBtn = document.getElementById('dish-form-cancel-btn');
  const form = document.getElementById('admin-dish-form');

  if (closeBtn) closeBtn.onclick = () => closeRestaurantMenuModal();
  if (cancelBtn) cancelBtn.onclick = () => hideDishForm();

  if (addDishBtn) {
    addDishBtn.onclick = () => {
      openDishForm();
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleDishFormSubmit();
    };
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeRestaurantMenuModal();
    };
  }
}

function openRestaurantMenuModal(restaurant) {
  currentMenuRestaurant = restaurant;
  const modal = document.getElementById('admin-menu-modal');
  const restName = document.getElementById('admin-menu-modal-rest-name');
  if (restName) {
    restName.textContent = `${restaurant.name} (${restaurant.category || 'Món ăn'})`;
  }

  hideDishForm();
  modal.classList.remove('hidden');
  loadRestaurantMenu(restaurant.id);
}

function closeRestaurantMenuModal() {
  const modal = document.getElementById('admin-menu-modal');
  if (modal) modal.classList.add('hidden');
  hideDishForm();
  currentMenuRestaurant = null;
  currentMenuList = [];
}

function openDishForm(dish = null) {
  const formWrapper = document.getElementById('admin-dish-form-wrapper');
  const formTitle = document.getElementById('admin-dish-form-title');
  const idInput = document.getElementById('dish-form-id');
  const nameInput = document.getElementById('dish-input-name');
  const priceInput = document.getElementById('dish-input-price');
  const catInput = document.getElementById('dish-input-category');
  const imgInput = document.getElementById('dish-input-image');
  const descInput = document.getElementById('dish-input-desc');
  const availInput = document.getElementById('dish-input-available');

  if (!formWrapper) return;

  if (dish) {
    formTitle.innerHTML = `<span class="material-symbols-outlined text-primary text-[18px]">edit</span><span>Chỉnh sửa món: ${escapeHtml(dish.name)}</span>`;
    idInput.value = dish.id;
    nameInput.value = dish.name || '';
    priceInput.value = dish.priceNum || (typeof dish.price === 'number' ? dish.price : parseInt(String(dish.price).replace(/\D/g, ''), 10)) || 50000;
    catInput.value = dish.category || (currentMenuRestaurant ? currentMenuRestaurant.category : '');
    imgInput.value = dish.image || '';
    descInput.value = dish.description || '';
    availInput.checked = dish.isAvailable !== false && dish.status !== 'out_of_stock';
  } else {
    formTitle.innerHTML = `<span class="material-symbols-outlined text-primary text-[18px]">add_circle</span><span>Thêm món ăn mới vào thực đơn</span>`;
    idInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    catInput.value = currentMenuRestaurant ? currentMenuRestaurant.category : '';
    imgInput.value = '';
    descInput.value = '';
    availInput.checked = true;
  }

  formWrapper.classList.remove('hidden');
  formWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  nameInput.focus();
}

function hideDishForm() {
  const formWrapper = document.getElementById('admin-dish-form-wrapper');
  const form = document.getElementById('admin-dish-form');
  if (formWrapper) formWrapper.classList.add('hidden');
  if (form) form.reset();
}

async function loadRestaurantMenu(restaurantId) {
  const tbody = document.getElementById('admin-menu-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-secondary">Đang tải danh sách món ăn...</td></tr>`;

  try {
    const res = await api.get(`/restaurants/${restaurantId}/menu`);
    if (res && res.success && Array.isArray(res.data)) {
      currentMenuList = res.data;
      // Cập nhật lại trong cachedRestaurants
      const found = cachedRestaurants.find(r => r.id === restaurantId);
      if (found) {
        found.menu = currentMenuList;
      }
      renderRestaurantMenuTable(currentMenuList);
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500">Không thể tải thực đơn.</td></tr>`;
    }
  } catch (err) {
    console.error('Lỗi tải thực đơn món:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-rose-500">Lỗi khi tải thực đơn món: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function renderRestaurantMenuTable(menu) {
  const tbody = document.getElementById('admin-menu-tbody');
  if (!tbody) return;

  if (!menu || menu.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-8 text-center text-secondary">
          <span class="material-symbols-outlined text-3xl mb-1 text-secondary/60">menu_book</span>
          <p class="font-medium">Quán chưa có món ăn nào trong thực đơn.</p>
          <p class="text-[11px] mt-1">Bấm "Thêm món mới" phía trên để bổ sung món ăn.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  menu.forEach((dish, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    const isAvail = dish.isAvailable !== false && dish.status !== 'out_of_stock';
    const priceNum = dish.priceNum || (typeof dish.price === 'number' ? dish.price : parseInt(String(dish.price).replace(/\D/g, ''), 10)) || 0;
    const priceFormatted = new Intl.NumberFormat('vi-VN').format(priceNum) + 'đ';

    tr.innerHTML = `
      <td class="p-3">
        <div class="flex items-center gap-3">
          <span class="text-[11px] text-secondary font-bold w-5">${idx + 1}</span>
          <img src="${dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80'}" class="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-surface-container" />
          <div class="min-w-0">
            <h5 class="font-bold text-xs text-on-surface truncate">${escapeHtml(dish.name)}</h5>
            <p class="text-[11px] text-secondary truncate max-w-xs mt-0.5" title="${escapeHtml(dish.description || '')}">
              ${escapeHtml(dish.description || 'Chưa có mô tả')}
            </p>
          </div>
        </div>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container-high text-secondary">
          ${escapeHtml(dish.category || 'Món chính')}
        </span>
      </td>
      <td class="p-3 font-bold text-primary text-xs">
        ${priceFormatted}
      </td>
      <td class="p-3">
        ${isAvail ? `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <span class="material-symbols-outlined text-[12px]">check_circle</span>
            <span>Còn hàng</span>
          </span>
        ` : `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
            <span class="material-symbols-outlined text-[12px]">do_not_disturb_on</span>
            <span>Hết hàng</span>
          </span>
        `}
      </td>
      <td class="p-3 text-right">
        <div class="flex items-center justify-end gap-1">
          <button class="toggle-stock-btn p-1.5 rounded-lg text-secondary hover:text-amber-600 hover:bg-amber-50 transition-colors" title="${isAvail ? 'Đánh dấu HẾT HÀNG' : 'Đánh dấu CÒN HÀNG'}">
            <span class="material-symbols-outlined text-[18px]">${isAvail ? 'toggle_on' : 'toggle_off'}</span>
          </button>
          <button class="edit-dish-btn p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-primary-container/10 transition-colors" title="Sửa thông tin món">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button class="del-dish-btn p-1.5 rounded-lg text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Xóa món khỏi thực đơn">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;

    tr.querySelector('.toggle-stock-btn').onclick = () => toggleDishStockStatus(dish);
    tr.querySelector('.edit-dish-btn').onclick = () => openDishForm(dish);
    tr.querySelector('.del-dish-btn').onclick = () => deleteDishItem(dish);

    tbody.appendChild(tr);
  });
}

async function handleDishFormSubmit() {
  if (!currentMenuRestaurant) return;

  const dishId = document.getElementById('dish-form-id').value;
  const name = document.getElementById('dish-input-name').value.trim();
  const priceVal = parseFloat(document.getElementById('dish-input-price').value);
  const category = document.getElementById('dish-input-category').value.trim();
  const image = document.getElementById('dish-input-image').value.trim();
  const description = document.getElementById('dish-input-desc').value.trim();
  const isAvailable = document.getElementById('dish-input-available').checked;

  if (!name) {
    toast.error('Vui lòng nhập tên món ăn.');
    return;
  }
  if (Number.isNaN(priceVal) || priceVal < 0) {
    toast.error('Vui lòng nhập giá bán hợp lệ.');
    return;
  }

  const payload = {
    name,
    price: `${new Intl.NumberFormat('vi-VN').format(priceVal)}đ`,
    priceNum: priceVal,
    category: category || currentMenuRestaurant.category || 'Món chính',
    image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
    description: description || '',
    isAvailable,
    status: isAvailable ? 'available' : 'out_of_stock'
  };

  try {
    let res;
    if (dishId) {
      res = await api.put(`/restaurants/${currentMenuRestaurant.id}/menu/${dishId}`, payload);
    } else {
      res = await api.post(`/restaurants/${currentMenuRestaurant.id}/menu`, payload);
    }

    if (res && res.success) {
      toast.success(res.message || 'Lưu món ăn thành công!');
      hideDishForm();
      await loadRestaurantMenu(currentMenuRestaurant.id);
      renderRestaurantsTable(cachedRestaurants);
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi lưu món ăn.');
  }
}

async function toggleDishStockStatus(dish) {
  if (!currentMenuRestaurant) return;

  const newAvailable = !(dish.isAvailable !== false && dish.status !== 'out_of_stock');
  try {
    const res = await api.patch(`/restaurants/${currentMenuRestaurant.id}/menu/${dish.id}/status`, {
      isAvailable: newAvailable,
      status: newAvailable ? 'available' : 'out_of_stock'
    });
    if (res && res.success) {
      toast.success(`Đã cập nhật món "${dish.name}": ${newAvailable ? 'Còn hàng' : 'Hết hàng'}`);
      await loadRestaurantMenu(currentMenuRestaurant.id);
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi cập nhật trạng thái món.');
  }
}

async function deleteDishItem(dish) {
  if (!currentMenuRestaurant) return;
  if (!confirm(`Bạn có chắc chắn muốn xóa món "${dish.name}" khỏi thực đơn?`)) return;

  try {
    const res = await api.delete(`/restaurants/${currentMenuRestaurant.id}/menu/${dish.id}`);
    if (res && res.success) {
      toast.success(res.message || 'Đã xóa món ăn khỏi thực đơn.');
      await loadRestaurantMenu(currentMenuRestaurant.id);
      renderRestaurantsTable(cachedRestaurants);
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi xóa món ăn.');
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
        ` : '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 cursor-default" title="Tài khoản khách hàng được bảo vệ, chỉ có thể khóa tài khoản">Được bảo vệ</span>')}
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
let cachedReviews = [];
let currentReviewFilter = 'all';
let currentReviewSearch = '';
let reviewsInitialized = false;

function formatReviewDateTime(iso) {
  if (!iso) return 'Gần đây';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function setupReviewsEvents() {
  if (reviewsInitialized) return;
  reviewsInitialized = true;

  const refreshBtn = document.getElementById('refresh-reviews-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadReviewsManager());
  }

  const searchInput = document.getElementById('admin-search-reviews');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentReviewSearch = e.target.value.trim().toLowerCase();
      filterAndRenderReviews();
    });
  }

  const filterBtns = document.querySelectorAll('.rev-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentReviewFilter = btn.dataset.filter || 'all';
      updateFilterButtonsUI();
      filterAndRenderReviews();
    });
  });
}

function updateFilterButtonsUI() {
  const filterBtns = document.querySelectorAll('.rev-filter-btn');
  filterBtns.forEach(btn => {
    if (btn.dataset.filter === currentReviewFilter) {
      btn.className = 'rev-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-primary-container text-on-primary shadow-sm whitespace-nowrap cursor-pointer';
    } else {
      btn.className = 'rev-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer';
    }
  });
}

function updateReviewCounts() {
  const total = cachedReviews.length;
  const approved = cachedReviews.filter(r => r.status === 'approved' || !r.status).length;
  const rejected = cachedReviews.filter(r => r.status === 'rejected' || r.status === 'hidden').length;

  const countAll = document.getElementById('rev-filter-count-all');
  const countApproved = document.getElementById('rev-filter-count-approved');
  const countRejected = document.getElementById('rev-filter-count-rejected');
  const navBadge = document.getElementById('nav-pending-badge');

  if (countAll) countAll.textContent = `(${total})`;
  if (countApproved) countApproved.textContent = approved;
  if (countRejected) countRejected.textContent = rejected;

  if (navBadge) {
    navBadge.classList.add('hidden');
  }
}

async function loadReviewsManager() {
  setupReviewsEvents();
  const tbody = document.getElementById('admin-reviews-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="p-8 text-center text-secondary">
        <div class="inline-flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          <span>Đang tải danh sách đánh giá...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const res = await api.get('/reviews/admin/all');
    if (res && res.success && Array.isArray(res.data)) {
      cachedReviews = res.data;
      updateReviewCounts();
      filterAndRenderReviews();
    } else {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-rose-500">Không tải được dữ liệu nhận xét.</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-rose-500">Lỗi nạp đánh giá: ${err.message || 'Lỗi kết nối'}</td></tr>`;
  }
}

function filterAndRenderReviews() {
  let list = [...cachedReviews];

  if (currentReviewFilter === 'approved') {
    list = list.filter(r => r.status === 'approved' || !r.status);
  } else if (currentReviewFilter === 'rejected') {
    list = list.filter(r => r.status === 'rejected' || r.status === 'hidden');
  }

  if (currentReviewSearch) {
    list = list.filter(r => {
      const inRest = (r.restaurantName || '').toLowerCase().includes(currentReviewSearch);
      const inUser = (r.userName || '').toLowerCase().includes(currentReviewSearch);
      const inContent = (r.content || '').toLowerCase().includes(currentReviewSearch);
      return inRest || inUser || inContent;
    });
  }

  renderReviewsTable(list);
}

async function updateReviewStatus(reviewId, newStatus) {
  try {
    const res = await api.patch(`/reviews/${reviewId}/status`, { status: newStatus });
    if (res && res.success) {
      if (newStatus === 'approved') {
        toast.success('Đã duyệt bình luận! Bình luận hiện đã được hiển thị công khai trên website.');
      } else if (newStatus === 'rejected') {
        toast.info('Đã từ chối bình luận. Bình luận sẽ không hiển thị trên website.');
      } else {
        toast.success(`Đã cập nhật trạng thái bình luận sang "${newStatus}".`);
      }

      const item = cachedReviews.find(r => r.id === Number(reviewId));
      if (item) item.status = newStatus;

      updateReviewCounts();
      filterAndRenderReviews();
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi cập nhật trạng thái bình luận.');
  }
}

async function deleteReview(reviewId) {
  if (!confirm('Bạn có chắc muốn xóa vĩnh viễn đánh giá này khỏi hệ thống? Thao tác này không thể hoàn tác!')) return;
  try {
    const res = await api.delete(`/reviews/${reviewId}`);
    if (res && res.success) {
      toast.success('Đã xóa đánh giá thành công.');
      cachedReviews = cachedReviews.filter(r => r.id !== Number(reviewId));
      updateReviewCounts();
      filterAndRenderReviews();
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi xóa đánh giá.');
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('admin-reviews-tbody');
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-10 text-center text-secondary">
          <div class="flex flex-col items-center justify-center">
            <span class="material-symbols-outlined text-4xl text-secondary/30 mb-2">rate_review</span>
            <p class="font-semibold text-on-surface text-xs">Không có đánh giá nào phù hợp với bộ lọc</p>
            <p class="text-[11px] text-secondary mt-0.5">Thử chọn tab khác hoặc xóa từ khóa tìm kiếm</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  reviews.forEach(rev => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    let statusBadge = '';
    if (rev.status === 'approved' || !rev.status) {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Công khai</span>`;
    } else if (rev.status === 'pending') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Chờ xử lý</span>`;
    } else if (rev.status === 'rejected') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Đã từ chối</span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span>Đã ẩn</span>`;
    }

    const ratingNum = Math.round(Number(rev.rating) || 5);
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="material-symbols-outlined text-[13px] ${i <= ratingNum ? 'text-amber-500' : 'text-secondary/30'}" style="${i <= ratingNum ? "font-variation-settings: 'FILL' 1;" : ''}">star</span>`;
    }

    tr.innerHTML = `
      <td class="p-4">
        <a href="/restaurant-detail.html?id=${rev.restaurantId}" target="_blank" class="font-bold text-on-surface hover:text-primary transition-colors flex items-center gap-1.5" title="Mở trang quán ăn">
          <span class="max-w-[180px] truncate">${escapeHtml(rev.restaurantName || 'Quán ăn')}</span>
          <span class="material-symbols-outlined text-[14px] text-secondary">open_in_new</span>
        </a>
        <span class="block text-[11px] text-secondary mt-0.5">Mã quán: #${rev.restaurantId}</span>
      </td>

      <td class="p-4">
        <div class="flex items-center gap-2.5">
          <img src="${rev.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.userName || 'U')}&background=ff6b35&color=fff`}" class="w-8 h-8 rounded-full object-cover ring-1 ring-surface-container flex-shrink-0" />
          <div class="min-w-0">
            <span class="font-bold text-on-surface truncate block">${escapeHtml(rev.userName || 'Người dùng')}</span>
            <span class="block text-[10px] text-secondary">UID: #${rev.userId || 'N/A'}</span>
          </div>
        </div>
      </td>

      <td class="p-4 whitespace-nowrap">
        <div class="flex items-center gap-1">
          <span class="font-black text-xs text-on-surface">${rev.rating}</span>
          <div class="flex items-center">${starsHtml}</div>
        </div>
      </td>

      <td class="p-4 text-on-surface-variant max-w-xs sm:max-w-md">
        <p class="text-xs leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">${escapeHtml(rev.content)}</p>
        ${Array.isArray(rev.images) && rev.images.length > 0 ? `
          <div class="flex gap-1.5 mt-2">
            ${rev.images.slice(0, 3).map(img => `<img src="${img}" alt="Ảnh review" class="w-10 h-10 rounded-lg object-cover border border-surface-container" />`).join('')}
          </div>
        ` : ''}
      </td>

      <td class="p-4 text-secondary text-[11px] whitespace-nowrap">
        ${formatReviewDateTime(rev.createdAt || rev.date)}
      </td>

      <td class="p-4 whitespace-nowrap">
        ${statusBadge}
      </td>

      <td class="p-4 text-right whitespace-nowrap">
        <div class="flex items-center justify-end gap-1.5">
          ${rev.status !== 'approved' ? `
            <button class="approve-rev-btn h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-sm transition-all cursor-pointer" data-id="${rev.id}" title="Duyệt bình luận này để hiển thị công khai trên website">
              <span class="material-symbols-outlined text-[15px]">check_circle</span>
              <span>Duyệt</span>
            </button>
          ` : ''}

          ${rev.status !== 'rejected' ? `
            <button class="reject-rev-btn h-8 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] inline-flex items-center gap-1 transition-all cursor-pointer" data-id="${rev.id}" title="Từ chối hiển thị bình luận này">
              <span class="material-symbols-outlined text-[15px]">cancel</span>
              <span>Từ chối</span>
            </button>
          ` : ''}

          <select class="rev-status-select bg-surface-container-low border border-surface-container rounded-xl px-2 py-1 text-[11px] font-semibold text-on-surface focus:outline-none focus:border-primary-container" data-id="${rev.id}" title="Đổi trạng thái nhanh">
            <option value="approved" ${rev.status === 'approved' ? 'selected' : ''}>Công khai</option>
            <option value="rejected" ${rev.status === 'rejected' ? 'selected' : ''}>Từ chối</option>
            <option value="hidden" ${rev.status === 'hidden' ? 'selected' : ''}>Đã ẩn</option>
          </select>

          <button class="del-review-btn text-secondary hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" data-id="${rev.id}" title="Xóa vĩnh viễn bình luận">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;

    // Bind Approve button
    const approveBtn = tr.querySelector('.approve-rev-btn');
    if (approveBtn) {
      approveBtn.onclick = () => updateReviewStatus(rev.id, 'approved');
    }

    // Bind Reject button
    const rejectBtn = tr.querySelector('.reject-rev-btn');
    if (rejectBtn) {
      rejectBtn.onclick = () => updateReviewStatus(rev.id, 'rejected');
    }

    // Bind status dropdown change
    const statusSelect = tr.querySelector('.rev-status-select');
    if (statusSelect) {
      statusSelect.onchange = (e) => updateReviewStatus(rev.id, e.target.value);
    }

    // Bind Delete button
    const delBtn = tr.querySelector('.del-review-btn');
    if (delBtn) {
      delBtn.onclick = () => deleteReview(rev.id);
    }

    tbody.appendChild(tr);
  });
}

// ==========================================
// 6. ORDERS MANAGEMENT
// ==========================================
let cachedAdminOrders = [];
let currentOrderFilter = 'all';

const ORDER_STATUS_MAP = {
  pending: { label: 'Chờ xác nhận', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-sky-100 text-sky-800 border-sky-300' },
  preparing: { label: 'Đang chuẩn bị', cls: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ready: { label: 'Sẵn sàng giao', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  shipping: { label: 'Đang giao', cls: 'bg-orange-100 text-orange-800 border-orange-300' },
  completed: { label: 'Hoàn tất', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  cancelled: { label: 'Đã hủy', cls: 'bg-rose-100 text-rose-800 border-rose-300' }
};

function formatVNDOrder(val) {
  return (Number(val) || 0).toLocaleString('vi-VN') + ' đ';
}

async function loadOrdersManager() {
  setupOrderControls();
  await refreshOrdersData();
}

let orderControlsBound = false;
function setupOrderControls() {
  if (orderControlsBound) return;
  orderControlsBound = true;

  // Refresh button
  document.getElementById('admin-refresh-orders-btn')?.addEventListener('click', async () => {
    await refreshOrdersData();
    toast.info('Đã làm mới danh sách đơn hàng.');
  });

  // Filter buttons
  const filterBtns = document.querySelectorAll('.order-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.className = 'order-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-low cursor-pointer';
      });
      btn.className = 'order-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-primary-container text-white cursor-pointer';
      currentOrderFilter = btn.dataset.filter || 'all';
      filterAndRenderAdminOrders();
    });
  });

  // Search input
  const searchInput = document.getElementById('admin-search-orders');
  searchInput?.addEventListener('input', () => {
    filterAndRenderAdminOrders();
  });

  // Close modal
  document.getElementById('admin-order-modal-close')?.addEventListener('click', () => {
    document.getElementById('admin-order-modal')?.classList.add('hidden');
  });
}

async function refreshOrdersData() {
  try {
    // 1. Fetch stats
    const statsRes = await api.get('/orders/admin/stats');
    if (statsRes && statsRes.success && statsRes.data) {
      const s = statsRes.data;
      const totalEl = document.getElementById('admin-order-stat-total');
      const pendingEl = document.getElementById('admin-order-stat-pending');
      const shippingEl = document.getElementById('admin-order-stat-shipping');
      const completedEl = document.getElementById('admin-order-stat-completed');
      const revenueEl = document.getElementById('admin-order-stat-revenue');

      if (totalEl) totalEl.textContent = s.total || 0;
      if (pendingEl) pendingEl.textContent = s.pending || 0;
      if (shippingEl) shippingEl.textContent = (s.confirmed || 0) + (s.preparing || 0) + (s.ready || 0) + (s.shipping || 0);
      if (completedEl) completedEl.textContent = s.completed || 0;
      if (revenueEl) revenueEl.textContent = formatVNDOrder(s.totalRevenue || 0);

      const badge = document.getElementById('nav-orders-badge');
      if (badge) {
        if (s.pending > 0) {
          badge.textContent = s.pending;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    }

    // 2. Fetch all orders
    const ordersRes = await api.get('/orders/admin/all');
    if (ordersRes && ordersRes.success && Array.isArray(ordersRes.data)) {
      cachedAdminOrders = ordersRes.data;
      filterAndRenderAdminOrders();
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu đơn hàng admin:', err);
    toast.error('Lỗi khi tải danh sách đơn hàng.');
  }
}

function filterAndRenderAdminOrders() {
  const q = (document.getElementById('admin-search-orders')?.value || '').toLowerCase().trim();
  let filtered = [...cachedAdminOrders];

  if (currentOrderFilter !== 'all') {
    filtered = filtered.filter(o => o.status === currentOrderFilter);
  }

  if (q) {
    filtered = filtered.filter(o =>
      (o.code && o.code.toLowerCase().includes(q)) ||
      (o.recipientName && o.recipientName.toLowerCase().includes(q)) ||
      (o.recipientPhone && o.recipientPhone.includes(q)) ||
      (o.restaurantName && o.restaurantName.toLowerCase().includes(q))
    );
  }

  renderAdminOrdersTable(filtered);
}

function renderAdminOrdersTable(orders) {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-secondary text-xs">
          <span class="material-symbols-outlined text-3xl mb-1 text-secondary/40">inbox</span>
          <p>Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  orders.forEach(order => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    const itemsSummary = (order.items || []).map(i => `${escapeHtml(i.name)} x${i.quantity}`).join(', ');

    tr.innerHTML = `
      <td class="p-4">
        <p class="font-bold text-primary font-mono">${escapeHtml(order.code)}</p>
        <p class="text-[11px] text-secondary mt-0.5">${formatDateAdmin(order.createdAt)}</p>
      </td>

      <td class="p-4">
        <p class="font-bold text-on-surface">${escapeHtml(order.recipientName)}</p>
        <p class="text-[11px] text-secondary">${escapeHtml(order.recipientPhone)}</p>
        <p class="text-[11px] text-secondary truncate max-w-xs mt-0.5" title="${escapeHtml(order.deliveryAddress)}">${escapeHtml(order.deliveryAddress)}</p>
      </td>

      <td class="p-4">
        <p class="font-bold text-on-surface">${escapeHtml(order.restaurantName)}</p>
        <p class="text-[11px] text-secondary truncate max-w-[160px]">${escapeHtml(order.restaurantAddress || '')}</p>
      </td>

      <td class="p-4">
        <p class="text-[11px] text-on-surface line-clamp-2 max-w-[180px]" title="${itemsSummary}">${itemsSummary}</p>
        <p class="text-[10px] text-secondary mt-0.5 font-semibold">${order.totalItems || (order.items || []).reduce((a,c)=>a+c.quantity,0)} món</p>
      </td>

      <td class="p-4">
        <p class="font-black text-on-surface">${formatVNDOrder(order.total)}</p>
        <div class="mt-0.5 flex items-center gap-1">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-secondary'}">
            ${order.paymentStatus === 'paid' ? 'Đã TT' : 'Chưa TT (COD)'}
          </span>
        </div>
      </td>

      <td class="p-4">
        <select class="admin-order-status-select h-8 px-2 rounded-lg text-xs font-bold border border-surface-container bg-surface-container-lowest focus:outline-none focus:border-primary-container cursor-pointer" data-order-id="${order.id}">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xác nhận</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận</option>
          <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Đang chuẩn bị</option>
          <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Sẵn sàng giao</option>
          <option value="shipping" ${order.status === 'shipping' ? 'selected' : ''}>Đang giao hàng</option>
          <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn tất</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
        </select>
      </td>

      <td class="p-4 text-right">
        <button type="button" class="admin-view-order-btn px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold transition-all cursor-pointer">
          Chi tiết
        </button>
      </td>
    `;

    // Bind change status
    const select = tr.querySelector('.admin-order-status-select');
    select?.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      await updateOrderStatusAdmin(order.id, newStatus);
    });

    // Bind view detail
    tr.querySelector('.admin-view-order-btn')?.addEventListener('click', () => {
      openAdminOrderDetailModal(order);
    });

    tbody.appendChild(tr);
  });
}

async function updateOrderStatusAdmin(orderId, status, note = '') {
  try {
    const res = await api.patch(`/orders/${orderId}/status`, { status, note });
    if (res && res.success) {
      toast.success(res.message || 'Cập nhật trạng thái thành công.');
      await refreshOrdersData();
    } else {
      toast.error(res?.message || 'Không thể cập nhật trạng thái đơn.');
    }
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái đơn:', err);
    toast.error(err.message || 'Lỗi khi cập nhật trạng thái đơn.');
  }
}

function openAdminOrderDetailModal(order) {
  const modal = document.getElementById('admin-order-modal');
  const codeEl = document.getElementById('admin-order-modal-code');
  const bodyEl = document.getElementById('admin-order-modal-body');

  if (codeEl) codeEl.textContent = order.code;
  if (!bodyEl) return;

  const statusMeta = ORDER_STATUS_MAP[order.status] || { label: order.status, cls: 'bg-gray-100 text-gray-800' };

  bodyEl.innerHTML = `
    <!-- Top summary -->
    <div class="p-4 rounded-2xl border ${statusMeta.cls} flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div>
        <p class="text-xs font-medium">Trạng thái hiện tại:</p>
        <p class="text-base font-black">${statusMeta.label}</p>
      </div>
      <div class="text-right">
        <p class="text-xs text-secondary">Tạo lúc: ${formatDateAdmin(order.createdAt)}</p>
        <p class="text-xs text-secondary">Cập nhật: ${formatDateAdmin(order.updatedAt || order.createdAt)}</p>
      </div>
    </div>

    <!-- Quick Update Status Form inside modal -->
    <div class="p-4 bg-surface-container-low rounded-2xl border border-surface-container space-y-3">
      <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider">Cập nhật trạng thái đơn</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-secondary mb-1">Chọn trạng thái mới:</label>
          <select id="modal-update-status-select" class="w-full h-9 px-3 bg-surface-container-lowest border border-surface-container rounded-xl text-xs font-bold focus:outline-none focus:border-primary-container">
            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xác nhận</option>
            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận</option>
            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Đang chuẩn bị</option>
            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Sẵn sàng giao</option>
            <option value="shipping" ${order.status === 'shipping' ? 'selected' : ''}>Đang giao hàng</option>
            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn tất</option>
            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-secondary mb-1">Ghi chú trạng thái (Tùy chọn):</label>
          <input id="modal-update-status-note" type="text" placeholder="Ví dụ: Đang đợi shipper đến lấy..." class="w-full h-9 px-3 bg-surface-container-lowest border border-surface-container rounded-xl text-xs focus:outline-none focus:border-primary-container" />
        </div>
      </div>
      <button id="modal-submit-status-btn" type="button" class="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all cursor-pointer">
        Lưu cập nhật trạng thái
      </button>
    </div>

    <!-- Customer & Delivery -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-surface-container-low p-4 rounded-2xl">
      <div>
        <p class="text-secondary font-medium">Người nhận hàng:</p>
        <p class="font-bold text-on-surface mt-0.5">${escapeHtml(order.recipientName)} - ${escapeHtml(order.recipientPhone)}</p>
        <p class="text-secondary font-medium mt-2">Tài khoản đặt đơn:</p>
        <p class="text-on-surface mt-0.5">${escapeHtml(order.userName || 'Khách')} (${escapeHtml(order.userEmail || '')})</p>
        <p class="text-secondary font-medium mt-2">Địa chỉ giao hàng:</p>
        <p class="font-semibold text-on-surface mt-0.5">${escapeHtml(order.deliveryAddress)}</p>
      </div>
      <div>
        <p class="text-secondary font-medium">Quán ăn:</p>
        <p class="font-bold text-on-surface mt-0.5">${escapeHtml(order.restaurantName)}</p>
        <p class="text-secondary mt-0.5">${escapeHtml(order.restaurantAddress || '')}</p>
        <p class="text-secondary font-medium mt-2">Ghi chú khách hàng:</p>
        <p class="text-on-surface mt-0.5 italic">${escapeHtml(order.note || 'Không có ghi chú')}</p>
        <p class="text-secondary font-medium mt-2">Phương thức thanh toán:</p>
        <p class="font-bold text-on-surface mt-0.5">${order.paymentMethod} (${order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'})</p>
      </div>
    </div>

    <!-- Items breakdown -->
    <div>
      <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">Chi tiết món ăn</h4>
      <div class="divide-y divide-surface-container bg-surface-container-low rounded-2xl p-4">
        ${(order.items || []).map(i => `
          <div class="py-2 flex items-center justify-between text-xs">
            <div>
              <p class="font-bold text-on-surface">${escapeHtml(i.name)} <span class="text-secondary font-normal">x${i.quantity}</span></p>
              ${i.note ? `<p class="text-[11px] text-secondary mt-0.5">Ghi chú: ${escapeHtml(i.note)}</p>` : ''}
            </div>
            <span class="font-bold text-primary">${formatVNDOrder(i.total || i.priceNum * i.quantity)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Timeline history -->
    <div>
      <h4 class="text-xs font-bold text-on-surface uppercase tracking-wider mb-2">Nhật ký tiến trình</h4>
      <div class="space-y-2 pl-2 border-l-2 border-primary/30 ml-2">
        ${(order.timeline || []).map(tl => `
          <div class="relative pl-3 text-xs">
            <div class="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-primary"></div>
            <p class="font-bold text-on-surface">${escapeHtml(tl.message || tl.status)}</p>
            <p class="text-[11px] text-secondary mt-0.5">${formatDateAdmin(tl.time)}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Cost summary -->
    <div class="space-y-1.5 pt-3 border-t border-surface-container text-xs">
      <div class="flex justify-between text-secondary">
        <span>Tạm tính:</span>
        <span class="font-bold text-on-surface">${formatVNDOrder(order.subtotal)}</span>
      </div>
      <div class="flex justify-between text-secondary">
        <span>Phí giao hàng:</span>
        <span class="font-bold text-on-surface">${order.shippingFee === 0 ? 'Miễn phí' : formatVNDOrder(order.shippingFee)}</span>
      </div>
      ${order.discount > 0 ? `
        <div class="flex justify-between text-emerald-600 font-bold">
          <span>Ưu đãi (${escapeHtml(order.couponCode || 'Giảm giá')}):</span>
          <span>-${formatVNDOrder(order.discount)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between text-base font-bold text-on-surface pt-2 border-t border-surface-container">
        <span>Tổng thanh toán:</span>
        <span class="text-primary font-black">${formatVNDOrder(order.total)}</span>
      </div>
    </div>
  `;

  // Bind modal submit
  document.getElementById('modal-submit-status-btn')?.addEventListener('click', async () => {
    const sel = document.getElementById('modal-update-status-select');
    const noteInput = document.getElementById('modal-update-status-note');
    if (!sel) return;
    await updateOrderStatusAdmin(order.id, sel.value, noteInput?.value.trim());
    modal?.classList.add('hidden');
  });

  modal?.classList.remove('hidden');
}

function formatDateAdmin(iso) {
  if (!iso) return 'Gần đây';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const two = n => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}


// ==========================================
// 7. COUPONS MANAGEMENT
// ==========================================
let cachedAdminCoupons = [];
let couponControlsBound = false;

async function loadCouponsManager() {
  setupCouponControls();
  await refreshCouponsData();
}

function setupCouponControls() {
  if (couponControlsBound) return;
  couponControlsBound = true;

  // Refresh
  document.getElementById('admin-refresh-coupons-btn')?.addEventListener('click', async () => {
    await refreshCouponsData();
    toast.info('Đã làm mới danh sách mã giảm giá.');
  });

  // Add new
  document.getElementById('admin-add-coupon-btn')?.addEventListener('click', () => {
    openCouponModal();
  });

  // Close modal
  document.getElementById('close-coupon-modal')?.addEventListener('click', closeCouponModal);
  document.getElementById('cancel-coupon-modal')?.addEventListener('click', closeCouponModal);

  // Form submit
  document.getElementById('coupon-modal-form')?.addEventListener('submit', handleCouponFormSubmit);

  // Change type label hint
  const typeSelect = document.getElementById('modal-coupon-type');
  const valLabel = document.getElementById('modal-coupon-value-label');
  const valInput = document.getElementById('modal-coupon-value');
  typeSelect?.addEventListener('change', () => {
    if (typeSelect.value === 'percent') {
      if (valLabel) valLabel.textContent = 'Mức giảm (%) (*):';
      if (valInput) {
        valInput.max = '100';
        valInput.placeholder = 'VD: 10, 20 (%)';
      }
    } else if (typeSelect.value === 'fixed') {
      if (valLabel) valLabel.textContent = 'Mức giảm (đ) (*):';
      if (valInput) {
        valInput.removeAttribute('max');
        valInput.placeholder = 'VD: 30000, 50000 (đ)';
      }
    } else if (typeSelect.value === 'freeship') {
      if (valLabel) valLabel.textContent = 'Mức hỗ trợ ship tối đa (đ) (*):';
      if (valInput) {
        valInput.removeAttribute('max');
        valInput.placeholder = 'VD: 15000 (đ)';
      }
    }
  });
}

async function refreshCouponsData() {
  const tbody = document.getElementById('admin-coupons-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-secondary">
          <div class="inline-flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span>Đang tải danh sách mã giảm giá...</span>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const res = await api.get('/coupons/admin/all');
    if (res && res.success && Array.isArray(res.data)) {
      cachedAdminCoupons = res.data;
      updateCouponStats(cachedAdminCoupons);
      renderCouponsTable(cachedAdminCoupons);
    } else {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-rose-500">Không tải được danh sách mã.</td></tr>`;
    }
  } catch (err) {
    console.error('Lỗi tải mã giảm giá:', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-rose-500">Lỗi: ${err.message || 'Lỗi kết nối'}</td></tr>`;
  }
}

function updateCouponStats(coupons) {
  const total = coupons.length;
  const active = coupons.filter(c => c.isActive !== false).length;
  const used = coupons.reduce((sum, c) => sum + (Number(c.usedCount) || 0), 0);

  const statTotal = document.getElementById('admin-coupon-stat-total');
  const statActive = document.getElementById('admin-coupon-stat-active');
  const statUsed = document.getElementById('admin-coupon-stat-used');

  if (statTotal) statTotal.textContent = total;
  if (statActive) statActive.textContent = active;
  if (statUsed) statUsed.textContent = used;
}

function renderCouponsTable(coupons) {
  const tbody = document.getElementById('admin-coupons-tbody');
  if (!tbody) return;

  if (coupons.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-10 text-center text-secondary">
          <span class="material-symbols-outlined text-4xl text-secondary/30 mb-2">loyalty</span>
          <p class="font-semibold text-on-surface text-xs">Chưa có mã giảm giá nào</p>
          <p class="text-[11px] text-secondary mt-0.5">Bấm "Thêm mã mới" để tạo mã khuyến mãi cho khách hàng</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  coupons.forEach(coupon => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    let typeBadge = '';
    let discountText = '';
    if (coupon.type === 'percent') {
      typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Phần trăm</span>';
      discountText = `<span class="font-black text-amber-700">${coupon.value}%</span> (Tối đa ${coupon.maxDiscount ? formatVNDOrder(coupon.maxDiscount) : 'Không giới hạn'})`;
    } else if (coupon.type === 'fixed') {
      typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Số tiền cố định</span>';
      discountText = `<span class="font-black text-emerald-700">${formatVNDOrder(coupon.value)}</span>`;
    } else if (coupon.type === 'freeship') {
      typeBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">Miễn phí ship</span>';
      discountText = `<span class="font-black text-sky-700">Tối đa ${formatVNDOrder(coupon.maxDiscount || coupon.value || 15000)}</span>`;
    }

    const minOrderText = coupon.minOrder > 0 ? formatVNDOrder(coupon.minOrder) : '0 đ';
    const dateRange = (coupon.startDate || 'Ngay') + ' → ' + (coupon.endDate || 'Vô hạn');
    const usage = `${coupon.usedCount || 0} / ${coupon.totalLimit > 0 ? coupon.totalLimit : '∞'}`;
    const isActive = coupon.isActive !== false;

    tr.innerHTML = `
      <td class="p-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[18px]">confirmation_number</span>
          <div>
            <span class="font-black text-primary font-mono text-xs tracking-wider">${escapeHtml(coupon.code)}</span>
            <p class="text-[11px] text-secondary mt-0.5 line-clamp-1 max-w-xs">${escapeHtml(coupon.description || '')}</p>
          </div>
        </div>
      </td>
      <td class="p-4">
        <div class="space-y-1">
          ${typeBadge}
          <div class="text-[11px]">${discountText}</div>
        </div>
      </td>
      <td class="p-4">
        <span class="font-bold text-on-surface">${minOrderText}</span>
      </td>
      <td class="p-4">
        <span class="text-[11px] text-secondary">${dateRange}</span>
      </td>
      <td class="p-4">
        <div class="text-xs font-semibold text-on-surface">${usage}</div>
        <span class="text-[10px] text-secondary">Tối đa ${coupon.perUserLimit || 1} lần/khách</span>
      </td>
      <td class="p-4">
        <button type="button" class="toggle-coupon-btn px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-surface-container text-secondary hover:bg-surface-container-high'}" data-id="${coupon.id}">
          ${isActive ? '● Đang bật' : '○ Tạm tắt'}
        </button>
      </td>
      <td class="p-4 text-right">
        <div class="inline-flex items-center gap-1">
          <button type="button" class="edit-coupon-btn p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-container transition-colors cursor-pointer" title="Chỉnh sửa">
            <span class="material-symbols-outlined text-[18px]">edit</span>
          </button>
          <button type="button" class="delete-coupon-btn p-1.5 rounded-lg text-secondary hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Xóa mã">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </td>
    `;

    // Bind toggle
    tr.querySelector('.toggle-coupon-btn')?.addEventListener('click', () => {
      toggleCouponStatus(coupon.id);
    });

    // Bind edit
    tr.querySelector('.edit-coupon-btn')?.addEventListener('click', () => {
      openCouponModal(coupon);
    });

    // Bind delete
    tr.querySelector('.delete-coupon-btn')?.addEventListener('click', () => {
      deleteCoupon(coupon.id, coupon.code);
    });

    tbody.appendChild(tr);
  });
}

async function openCouponModal(coupon = null) {
  const modal = document.getElementById('coupon-modal');
  const title = document.getElementById('coupon-modal-title');
  const form = document.getElementById('coupon-modal-form');
  if (!modal || !form) return;

  if (cachedRestaurants.length === 0) {
    try {
      const restRes = await api.get('/restaurants');
      if (restRes && restRes.success && Array.isArray(restRes.data)) {
        cachedRestaurants = restRes.data;
      }
    } catch (_) {}
  }

  // Populate restaurant scope dropdown
  const scopeSelect = document.getElementById('modal-coupon-scope');
  if (scopeSelect) {
    scopeSelect.innerHTML = `<option value="all">Tất cả quán ăn</option>` +
      cachedRestaurants.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  }

  if (coupon) {
    title.textContent = `Chỉnh sửa mã: ${coupon.code}`;
    document.getElementById('modal-coupon-id').value = coupon.id;
    document.getElementById('modal-coupon-code').value = coupon.code;
    document.getElementById('modal-coupon-type').value = coupon.type || 'percent';
    document.getElementById('modal-coupon-value').value = coupon.value || 0;
    document.getElementById('modal-coupon-max-discount').value = coupon.maxDiscount || 0;
    document.getElementById('modal-coupon-min-order').value = coupon.minOrder || 0;
    document.getElementById('modal-coupon-start-date').value = (coupon.startDate || '').slice(0, 10);
    document.getElementById('modal-coupon-end-date').value = (coupon.endDate || '').slice(0, 10);
    document.getElementById('modal-coupon-total-limit').value = coupon.totalLimit || 100;
    document.getElementById('modal-coupon-user-limit').value = coupon.perUserLimit || 1;
    document.getElementById('modal-coupon-desc').value = coupon.description || '';
    if (scopeSelect) scopeSelect.value = coupon.scope || 'all';
    document.getElementById('modal-coupon-is-active').checked = coupon.isActive !== false;
  } else {
    title.textContent = 'Thêm Mã Giảm Giá Mới';
    form.reset();
    document.getElementById('modal-coupon-id').value = '';
    document.getElementById('modal-coupon-type').value = 'percent';
    document.getElementById('modal-coupon-start-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('modal-coupon-total-limit').value = 100;
    document.getElementById('modal-coupon-user-limit').value = 1;
    document.getElementById('modal-coupon-is-active').checked = true;
    if (scopeSelect) scopeSelect.value = 'all';
  }

  // Trigger change to update labels
  document.getElementById('modal-coupon-type')?.dispatchEvent(new Event('change'));

  modal.classList.remove('hidden');
}

function closeCouponModal() {
  document.getElementById('coupon-modal')?.classList.add('hidden');
}

async function handleCouponFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('modal-coupon-id').value;
  const payload = {
    code: document.getElementById('modal-coupon-code').value.trim().toUpperCase(),
    type: document.getElementById('modal-coupon-type').value,
    value: Number(document.getElementById('modal-coupon-value').value) || 0,
    maxDiscount: Number(document.getElementById('modal-coupon-max-discount').value) || 0,
    minOrder: Number(document.getElementById('modal-coupon-min-order').value) || 0,
    startDate: document.getElementById('modal-coupon-start-date').value,
    endDate: document.getElementById('modal-coupon-end-date').value,
    totalLimit: Number(document.getElementById('modal-coupon-total-limit').value) || 100,
    perUserLimit: Number(document.getElementById('modal-coupon-user-limit').value) || 1,
    scope: document.getElementById('modal-coupon-scope').value,
    description: document.getElementById('modal-coupon-desc').value.trim(),
    isActive: document.getElementById('modal-coupon-is-active').checked
  };

  try {
    let res;
    if (id) {
      res = await api.put(`/coupons/admin/${id}`, payload);
    } else {
      res = await api.post('/coupons/admin', payload);
    }

    if (res && res.success) {
      toast.success(res.message || 'Lưu mã giảm giá thành công!');
      closeCouponModal();
      await refreshCouponsData();
    } else {
      toast.error(res?.message || 'Không thể lưu mã giảm giá.');
    }
  } catch (err) {
    console.error('Lỗi lưu coupon:', err);
    toast.error(err.message || 'Lỗi khi lưu mã giảm giá.');
  }
}

async function toggleCouponStatus(id) {
  try {
    const res = await api.patch(`/coupons/admin/${id}/status`, {});
    if (res && res.success) {
      toast.success(res.message || 'Đã cập nhật trạng thái mã.');
      await refreshCouponsData();
    } else {
      toast.error(res?.message || 'Không thể đổi trạng thái mã.');
    }
  } catch (err) {
    console.error('Lỗi đổi trạng thái coupon:', err);
    toast.error(err.message || 'Lỗi khi đổi trạng thái mã.');
  }
}

async function deleteCoupon(id, code) {
  if (!confirm(`Bạn có chắc muốn xóa mã giảm giá "${code}"?`)) return;
  try {
    const res = await api.delete(`/coupons/admin/${id}`);
    if (res && res.success) {
      toast.success(res.message || 'Đã xóa mã giảm giá thành công.');
      await refreshCouponsData();
    } else {
      toast.error(res?.message || 'Không thể xóa mã giảm giá.');
    }
  } catch (err) {
    console.error('Lỗi xóa coupon:', err);
    toast.error(err.message || 'Lỗi khi xóa mã giảm giá.');
  }
}

