// FoodHub Explore Page Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, isLoggedIn } from './auth.js';
import { createRestaurantCard } from './components/restaurantCard.js';

let state = {
  search: '',
  category: '',
  area: '',
  minPrice: '',
  maxPrice: '',
  sortBy: 'rating',
  order: 'desc',
  page: 1,
  limit: 8,
  totalPages: 1,
  totalItems: 0
};

let favoriteIds = [];

document.addEventListener('DOMContentLoaded', async () => {
  initHeader('explore');
  initFooter();

  // Read URL query params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('q')) state.search = urlParams.get('q');
  if (urlParams.has('category')) state.category = urlParams.get('category');
  if (urlParams.has('area')) state.area = urlParams.get('area');
  if (urlParams.has('minPrice')) state.minPrice = urlParams.get('minPrice');
  if (urlParams.has('maxPrice')) state.maxPrice = urlParams.get('maxPrice');
  if (urlParams.has('page')) state.page = parseInt(urlParams.get('page'), 10) || 1;

  // Sync inputs with URL state
  const searchInput = document.getElementById('filter-search');
  const categorySelect = document.getElementById('filter-category');
  const areaSelect = document.getElementById('filter-area');
  const sortSelect = document.getElementById('filter-sort');

  if (searchInput && state.search) searchInput.value = state.search;
  if (areaSelect && state.area) areaSelect.value = state.area;

  // Load Categories into dropdown
  await loadCategories();
  if (categorySelect && state.category) {
    categorySelect.value = state.category;
  }

  // Load User's Favorites if logged in
  if (isLoggedIn()) {
    try {
      const favRes = await api.get('/favorites/ids');
      if (favRes && favRes.success && Array.isArray(favRes.data)) {
        favoriteIds = favRes.data;
      }
    } catch (e) {
      console.warn('Could not load favorite ids', e);
    }
  }

  // Bind Event Listeners
  bindEvents();

  // Fetch initial restaurants
  await fetchRestaurants();
});

async function loadCategories() {
  const categorySelect = document.getElementById('filter-category');
  if (!categorySelect) return;

  try {
    const res = await api.get('/categories');
    if (res && res.success && Array.isArray(res.data)) {
      res.data.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = `${cat.name} (${cat.count || 0})`;
        categorySelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Lỗi nạp danh mục:', err);
  }
}

function bindEvents() {
  const searchInput = document.getElementById('filter-search');
  const categorySelect = document.getElementById('filter-category');
  const areaSelect = document.getElementById('filter-area');
  const sortSelect = document.getElementById('filter-sort');
  const resetBtn = document.getElementById('reset-filters-btn');
  const emptyResetBtn = document.getElementById('empty-reset-btn');

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        syncUrl();
        fetchRestaurants();
      }, 400);
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      state.category = e.target.value;
      state.page = 1;
      syncUrl();
      fetchRestaurants();
    });
  }

  if (areaSelect) {
    areaSelect.addEventListener('change', (e) => {
      state.area = e.target.value;
      state.page = 1;
      syncUrl();
      fetchRestaurants();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const [field, dir] = val.split('_');
      state.sortBy = field;
      state.order = dir;
      state.page = 1;
      syncUrl();
      fetchRestaurants();
    });
  }

  // Price chips
  document.querySelectorAll('.price-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.price-chip').forEach(b => {
        b.classList.remove('bg-primary-container', 'text-on-primary', 'border-primary-container');
        b.classList.add('text-secondary', 'border-surface-container-high');
      });

      btn.classList.add('bg-primary-container', 'text-on-primary', 'border-primary-container');
      btn.classList.remove('text-secondary', 'border-surface-container-high');

      state.minPrice = btn.dataset.min || '';
      state.maxPrice = btn.dataset.max || '';
      state.page = 1;
      syncUrl();
      fetchRestaurants();
    });
  });

  const resetAll = () => {
    state.search = '';
    state.category = '';
    state.area = '';
    state.minPrice = '';
    state.maxPrice = '';
    state.sortBy = 'rating';
    state.order = 'desc';
    state.page = 1;

    if (searchInput) searchInput.value = '';
    if (categorySelect) categorySelect.value = '';
    if (areaSelect) areaSelect.value = '';
    if (sortSelect) sortSelect.value = 'rating_desc';

    document.querySelectorAll('.price-chip').forEach(b => {
      b.classList.remove('bg-primary-container', 'text-on-primary', 'border-primary-container');
      b.classList.add('text-secondary', 'border-surface-container-high');
    });

    syncUrl();
    fetchRestaurants();
  };

  if (resetBtn) resetBtn.addEventListener('click', resetAll);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAll);
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.search) params.set('q', state.search);
  if (state.category) params.set('category', state.category);
  if (state.area) params.set('area', state.area);
  if (state.minPrice) params.set('minPrice', state.minPrice);
  if (state.maxPrice) params.set('maxPrice', state.maxPrice);
  if (state.page > 1) params.set('page', state.page);

  const queryString = params.toString();
  const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;
  window.history.replaceState({}, '', newUrl);
}

async function fetchRestaurants() {
  const grid = document.getElementById('explore-grid');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('results-count');

  if (!grid) return;

  // Show Skeleton Loading
  grid.innerHTML = Array(4).fill(0).map(() => `
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div class="aspect-[16/10] bg-surface-container-high"></div>
      <div class="p-4 space-y-3">
        <div class="h-4 bg-surface-container-high rounded w-3/4"></div>
        <div class="h-3 bg-surface-container-high rounded w-1/2"></div>
        <div class="h-3 bg-surface-container-high rounded w-full"></div>
      </div>
    </div>
  `).join('');

  if (emptyState) emptyState.classList.add('hidden');

  try {
    const query = new URLSearchParams({
      page: state.page,
      limit: state.limit,
      sortBy: state.sortBy,
      order: state.order
    });

    if (state.search) query.set('search', state.search);
    if (state.category) query.set('category', state.category);
    if (state.area) query.set('area', state.area);
    if (state.minPrice) query.set('minPrice', state.minPrice);
    if (state.maxPrice) query.set('maxPrice', state.maxPrice);

    const res = await api.get(`/restaurants?${query.toString()}`);

    if (res && res.success) {
      grid.innerHTML = '';
      state.totalItems = res.pagination ? res.pagination.total : res.data.length;
      state.totalPages = res.pagination ? res.pagination.totalPages : 1;

      if (countBadge) {
        countBadge.textContent = `${state.totalItems} quán ăn`;
      }

      if (res.data.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        res.data.forEach(rest => {
          const card = createRestaurantCard(rest, favoriteIds);
          grid.appendChild(card);
        });
      }

      renderPagination();
    }
  } catch (err) {
    console.error('Lỗi nạp quán ăn:', err);
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-rose-500 font-medium">
        Đã có lỗi xảy ra khi nạp danh sách quán ăn. Vui lòng thử lại.
      </div>
    `;
  }
}

function renderPagination() {
  const container = document.getElementById('pagination-wrapper');
  if (!container) return;

  if (state.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Nút Prev
  html += `
    <button
      type="button"
      class="h-9 px-3 rounded-lg border border-surface-container-high text-xs font-semibold ${state.page > 1 ? 'hover:bg-surface-container-low text-on-surface' : 'opacity-40 cursor-not-allowed text-secondary'}"
      ${state.page <= 1 ? 'disabled' : ''}
      data-page="${state.page - 1}"
    >
      Trang trước
    </button>
  `;

  // Các số trang
  for (let i = 1; i <= state.totalPages; i++) {
    const isCurrent = i === state.page;
    html += `
      <button
        type="button"
        class="w-9 h-9 rounded-lg text-xs font-bold transition-all ${isCurrent ? 'bg-primary-container text-on-primary shadow-sm' : 'border border-surface-container-high text-secondary hover:bg-surface-container-low'}"
        data-page="${i}"
      >
        ${i}
      </button>
    `;
  }

  // Nút Next
  html += `
    <button
      type="button"
      class="h-9 px-3 rounded-lg border border-surface-container-high text-xs font-semibold ${state.page < state.totalPages ? 'hover:bg-surface-container-low text-on-surface' : 'opacity-40 cursor-not-allowed text-secondary'}"
      ${state.page >= state.totalPages ? 'disabled' : ''}
      data-page="${state.page + 1}"
    >
      Trang sau
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page, 10);
      if (p && p !== state.page && p >= 1 && p <= state.totalPages) {
        state.page = p;
        syncUrl();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchRestaurants();
      }
    });
  });
}
