// FoodHub Home Page Logic
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, isLoggedIn } from './auth.js';
import { createRestaurantCard } from './components/restaurantCard.js';

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

  // Quick tags
  document.querySelectorAll('.quick-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const text = tag.textContent.trim();
      window.location.href = `/explore.html?q=${encodeURIComponent(text)}`;
    });
  });

  // 2. Fetch Favorite IDs for current user (if logged in)
  let favoriteIds = [];
  if (isLoggedIn()) {
    try {
      const favRes = await api.get('/favorites/ids');
      if (favRes && favRes.success && Array.isArray(favRes.data)) {
        favoriteIds = favRes.data;
      }
    } catch (e) {
      console.warn('Could not load user favorite ids', e);
    }
  }

  // 3. Dynamic Category Chips
  const categoryScroll = document.querySelector('.category-scroll') || document.getElementById('category-container');
  if (categoryScroll) {
    try {
      const catRes = await api.get('/categories');
      if (catRes && catRes.success && Array.isArray(catRes.data)) {
        categoryScroll.innerHTML = `
          <button type="button" class="cat-btn flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all bg-primary-container text-on-primary shadow-sm hover:scale-105" data-cat="all">
            Tất cả
          </button>
        `;
        catRes.data.forEach(cat => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cat-btn flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all bg-surface-container-lowest text-on-surface hover:bg-surface-container-high border border-surface-container-high hover:scale-105';
          btn.dataset.cat = cat.name;
          btn.textContent = `${cat.name} (${cat.count || 0})`;
          btn.addEventListener('click', () => {
            window.location.href = `/explore.html?category=${encodeURIComponent(cat.name)}`;
          });
          categoryScroll.appendChild(btn);
        });
      }
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  }

  // 4. Load Featured Restaurants into Grid
  const featuredGrid = document.getElementById('restaurantGrid') || document.getElementById('featured-grid');
  if (featuredGrid) {
    try {
      featuredGrid.innerHTML = `
        <div class="col-span-full py-12 flex flex-col items-center justify-center text-secondary">
          <span class="material-symbols-outlined text-4xl animate-spin text-primary-container mb-2">progress_activity</span>
          <p class="text-sm">Đang tải danh sách quán ăn chất lượng...</p>
        </div>
      `;

      const restRes = await api.get('/restaurants?limit=8&sortBy=rating&order=desc');
      if (restRes && restRes.success && Array.isArray(restRes.data)) {
        featuredGrid.innerHTML = '';
        if (restRes.data.length === 0) {
          featuredGrid.innerHTML = `
            <div class="col-span-full py-12 text-center text-secondary text-sm">
              Chưa có dữ liệu quán ăn.
            </div>
          `;
        } else {
          restRes.data.forEach(restaurant => {
            const card = createRestaurantCard(restaurant, favoriteIds);
            featuredGrid.appendChild(card);
          });
        }
      }
    } catch (err) {
      console.error('Lỗi tải danh sách quán ăn:', err);
      featuredGrid.innerHTML = `
        <div class="col-span-full py-8 text-center text-rose-500 text-sm">
          Không thể tải dữ liệu quán ăn từ máy chủ. Vui lòng thử lại sau.
        </div>
      `;
    }
  }
});
