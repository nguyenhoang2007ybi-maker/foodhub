// FoodHub Home Page Logic
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, isLoggedIn } from './auth.js';
import { createRestaurantCard } from './components/restaurantCard.js';

let allRestaurants = [];
let favoriteIds = [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  initHeader('home');
  initFooter();

  // 1. Search Bar Binding
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  const handleSearch = () => {
    const val = searchInput ? searchInput.value.trim() : '';
    if (val) {
      window.location.href = `/explore.html?q=${encodeURIComponent(val)}`;
    } else {
      window.location.href = '/explore.html';
    }
  };

  if (searchBtn) {
    searchBtn.addEventListener('click', handleSearch);
  }
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  // Quick tags (Bún chả, Phở bò, Trà sữa, Bánh mì...)
  document.querySelectorAll('.quick-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const text = tag.textContent.trim();
      window.location.href = `/explore.html?q=${encodeURIComponent(text)}`;
    });
  });

  // 2. Fetch Favorite IDs for current user (if logged in)
  if (isLoggedIn()) {
    try {
      const favRes = await api.get('/favorites/ids');
      if (favRes && favRes.success && Array.isArray(favRes.data)) {
        favoriteIds = favRes.data;
        const savedCounterText = document.getElementById('savedCounterText');
        if (savedCounterText) {
          savedCounterText.textContent = `Đã lưu: ${favoriteIds.length} quán`;
        }
      }
    } catch (e) {
      console.warn('Could not load user favorite ids', e);
    }
  }

  // 3. Dynamic Category Chips
  await loadCategories();

  // 4. Load Featured Restaurants into Grid
  await loadRestaurants();

  // 5. Sort selector binding
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      applySorting(e.target.value);
    });
  }

  // Listen to favorite change event to keep home page counter in sync
  window.addEventListener('foodhub:favorite-changed', (e) => {
    const { restaurantId, isFavorite } = e.detail;
    if (isFavorite && !favoriteIds.includes(restaurantId)) {
      favoriteIds.push(restaurantId);
    } else if (!isFavorite) {
      favoriteIds = favoriteIds.filter(id => id !== restaurantId);
    }
    const savedCounterText = document.getElementById('savedCounterText');
    if (savedCounterText) {
      savedCounterText.textContent = `Đã lưu: ${favoriteIds.length} quán`;
    }
  });
});

async function loadCategories() {
  const container = document.getElementById('categoryContainer') || document.getElementById('category-container') || document.querySelector('.category-scroll');
  if (!container) return;

  try {
    const res = await api.get('/categories');
    if (res && res.success && Array.isArray(res.data)) {
      container.innerHTML = `
        <button type="button" class="cat-chip whitespace-nowrap px-5 py-2 rounded-full font-label-md text-label-md transition-all bg-primary-container text-on-primary shadow-sm hover:scale-105 cursor-pointer" data-cat="all">
          Tất cả
        </button>
      `;

      res.data.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cat-chip whitespace-nowrap px-5 py-2 rounded-full font-label-md text-label-md transition-all bg-surface-container-lowest text-on-surface hover:text-primary-container shadow-sm border border-surface-container-high hover:scale-105 cursor-pointer';
        btn.dataset.cat = cat.name;
        btn.textContent = `${cat.name} (${cat.count || 0})`;
        container.appendChild(btn);
      });

      // Bind category click events
      container.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          container.querySelectorAll('.cat-chip').forEach(c => {
            c.classList.remove('bg-primary-container', 'text-on-primary');
            c.classList.add('bg-surface-container-lowest', 'text-on-surface');
          });

          chip.classList.add('bg-primary-container', 'text-on-primary');
          chip.classList.remove('bg-surface-container-lowest', 'text-on-surface');

          currentCategory = chip.dataset.cat;
          renderFilteredRestaurants();
        });
      });
    }
  } catch (err) {
    console.error('Lỗi tải danh mục:', err);
  }
}

async function loadRestaurants() {
  const grid = document.getElementById('restaurantGrid') || document.getElementById('featured-grid');
  const itemCount = document.getElementById('itemCount');
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-span-full py-12 flex flex-col items-center justify-center text-secondary">
      <span class="material-symbols-outlined text-4xl animate-spin text-primary-container mb-2">progress_activity</span>
      <p class="text-sm">Đang tải danh sách quán ăn chất lượng...</p>
    </div>
  `;

  try {
    const res = await api.get('/restaurants?limit=12&sortBy=rating&order=desc');
    if (res && res.success && Array.isArray(res.data)) {
      allRestaurants = res.data;
      renderFilteredRestaurants();
    }
  } catch (err) {
    console.error('Lỗi tải danh sách quán ăn:', err);
    grid.innerHTML = `
      <div class="col-span-full py-8 text-center text-rose-500 text-sm">
        Không thể tải dữ liệu quán ăn từ máy chủ. Vui lòng kiểm tra backend server.
      </div>
    `;
  }
}

function renderFilteredRestaurants() {
  const grid = document.getElementById('restaurantGrid') || document.getElementById('featured-grid');
  const itemCount = document.getElementById('itemCount');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  grid.innerHTML = '';

  let filtered = allRestaurants;
  if (currentCategory && currentCategory !== 'all') {
    filtered = allRestaurants.filter(r => r.category && r.category.toLowerCase().includes(currentCategory.toLowerCase()));
  }

  if (itemCount) {
    itemCount.textContent = `(${filtered.length} quán)`;
  }

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-secondary text-sm">
        Không tìm thấy quán ăn thuộc danh mục này. Hãy thử chọn danh mục khác hoặc <a href="/explore.html" class="text-primary font-bold hover:underline">khám phá thêm</a>!
      </div>
    `;
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    filtered.forEach(restaurant => {
      const card = createRestaurantCard(restaurant, favoriteIds);
      grid.appendChild(card);
    });
  }
}

function applySorting(type) {
  if (type === 'rating') {
    allRestaurants.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (type === 'reviews') {
    allRestaurants.sort((a, b) => (Number(b.reviewsCount) || 0) - (Number(a.reviewsCount) || 0));
  } else {
    // Default
    allRestaurants.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  }
  renderFilteredRestaurants();
}
