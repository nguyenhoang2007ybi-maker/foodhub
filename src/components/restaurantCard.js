// Shared FoodHub Restaurant Card Component
import { api } from '../api.js';
import { toast } from '../toast.js';
import { isLoggedIn, updateFavoritesBadge } from '../auth.js';

export function createRestaurantCard(restaurant, favoriteIds = []) {
  const isFav = favoriteIds.includes(restaurant.id) || restaurant.isFavorite;

  const card = document.createElement('div');
  card.className = 'group bg-surface-container-lowest border border-surface-container-high hover:border-primary-container/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full';
  card.dataset.id = restaurant.id;
  card.dataset.category = restaurant.category || '';
  card.dataset.area = restaurant.area || '';
  card.dataset.price = restaurant.price || '';
  card.dataset.rating = restaurant.rating || 0;

  const defaultImg = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80';
  const imgUrl = restaurant.image || defaultImg;

  card.innerHTML = `
    <!-- Card Image & Badges -->
    <div class="relative aspect-[16/10] overflow-hidden bg-surface-container-low">
      <img
        src="${imgUrl}"
        alt="${restaurant.name}"
        loading="lazy"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onerror="this.src='${defaultImg}'"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10"></div>

      <!-- Top Badges -->
      <div class="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-container-lowest/90 backdrop-blur text-primary shadow-sm">
          ${restaurant.category || 'Ẩm thực'}
        </span>
        ${restaurant.featured ? `
          <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white shadow-sm flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1;">star</span>
            <span>Nổi bật</span>
          </span>
        ` : ''}
      </div>

      <!-- Favorite Button -->
      <button
        type="button"
        class="fav-toggle-btn absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur hover:bg-surface-container-lowest text-secondary flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-all cursor-pointer z-10"
        aria-label="Yêu thích"
        data-id="${restaurant.id}"
      >
        <span class="material-symbols-outlined text-[20px] ${isFav ? 'text-rose-500' : 'text-secondary'}" style="${isFav ? "font-variation-settings: 'FILL' 1;" : ''}">
          favorite
        </span>
      </button>

      <!-- Rating Pill on Image -->
      <div class="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur text-white text-xs font-bold">
        <span class="material-symbols-outlined text-[14px] text-amber-400" style="font-variation-settings: 'FILL' 1;">star</span>
        <span>${Number(restaurant.rating || 0).toFixed(1)}</span>
        <span class="text-white/70 font-normal text-[11px]">(${restaurant.reviewsCount || 0})</span>
      </div>
    </div>

    <!-- Card Content -->
    <div class="p-4 flex-1 flex flex-col justify-between">
      <div>
        <h3 class="font-bold text-base text-on-surface group-hover:text-primary transition-colors line-clamp-1 mb-1">
          <a href="/restaurant-detail.html?id=${restaurant.id}" class="after:inset-0">
            ${restaurant.name}
          </a>
        </h3>

        <p class="text-xs text-secondary flex items-center gap-1 mb-2 line-clamp-1">
          <span class="material-symbols-outlined text-[15px] flex-shrink-0 text-secondary">location_on</span>
          <span>${restaurant.address || 'Hà Nội'}</span>
        </p>

        <p class="text-xs text-on-surface-variant line-clamp-2 mb-3">
          ${restaurant.description || 'Không gian ẩm thực ấn tượng với hương vị đậm đà thơm ngon.'}
        </p>
      </div>

      <!-- Card Footer -->
      <div class="pt-3 border-t border-surface-container-high flex items-center justify-between">
        <div class="flex items-center gap-1 text-primary font-bold text-xs">
          <span class="material-symbols-outlined text-[15px]">payments</span>
          <span>${restaurant.price || '30.000đ - 100.000đ'}</span>
        </div>

        <a
          href="/restaurant-detail.html?id=${restaurant.id}"
          class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container transition-colors"
        >
          <span>Xem quán</span>
          <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
        </a>
      </div>
    </div>
  `;

  // Gắn sự kiện yêu thích
  const favBtn = card.querySelector('.fav-toggle-btn');
  favBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn()) {
      toast.warning('Vui lòng đăng nhập để lưu quán vào danh sách yêu thích!');
      setTimeout(() => {
        window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 800);
      return;
    }

    try {
      const res = await api.post('/favorites/toggle', { restaurantId: restaurant.id });
      if (res && res.success) {
        const heartIcon = favBtn.querySelector('.material-symbols-outlined');
        if (res.isFavorite) {
          heartIcon.classList.remove('text-secondary');
          heartIcon.classList.add('text-rose-500');
          heartIcon.style.fontVariationSettings = "'FILL' 1";
          toast.success(`Đã thêm "${restaurant.name}" vào Yêu thích`);
        } else {
          heartIcon.classList.remove('text-rose-500');
          heartIcon.classList.add('text-secondary');
          heartIcon.style.fontVariationSettings = '';
          toast.info(`Đã bỏ lưu "${restaurant.name}"`);
        }
        updateFavoritesBadge();

        // Dispatch custom event to notify favorites page if needed
        window.dispatchEvent(new CustomEvent('foodhub:favorite-changed', {
          detail: { restaurantId: restaurant.id, isFavorite: res.isFavorite }
        }));
      }
    } catch (err) {
      toast.error('Không thể cập nhật danh sách yêu thích.');
    }
  });

  return card;
}
