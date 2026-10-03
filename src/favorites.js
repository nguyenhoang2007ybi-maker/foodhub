// FoodHub Favorites Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, requireAuth, updateFavoritesBadge } from './auth.js';
import { createRestaurantCard } from './components/restaurantCard.js';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  initHeader('favorites');
  initFooter();

  await loadFavorites();

  // Listen to favorite change event to update the page in real-time
  window.addEventListener('foodhub:favorite-changed', (e) => {
    const { restaurantId, isFavorite } = e.detail;
    if (!isFavorite) {
      const card = document.querySelector(`[data-id="${restaurantId}"]`);
      if (card) {
        card.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
          if (card.parentElement) card.parentElement.removeChild(card);
          checkEmpty();
        }, 300);
      }
    }
  });
});

async function loadFavorites() {
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  const totalText = document.getElementById('fav-total-text');

  if (!grid) return;

  // Skeletons
  grid.innerHTML = Array(4).fill(0).map(() => `
    <div class="bg-surface-container-lowest border border-surface-container-high rounded-2xl overflow-hidden shadow-sm animate-pulse">
      <div class="aspect-[16/10] bg-surface-container-high"></div>
      <div class="p-4 space-y-3">
        <div class="h-4 bg-surface-container-high rounded w-3/4"></div>
        <div class="h-3 bg-surface-container-high rounded w-1/2"></div>
      </div>
    </div>
  `).join('');

  if (empty) empty.classList.add('hidden');

  try {
    const res = await api.get('/favorites');
    if (res && res.success && Array.isArray(res.data)) {
      grid.innerHTML = '';
      const list = res.data;
      const favIds = list.map(r => r.id);

      if (totalText) totalText.textContent = `${list.length} quán đã lưu`;

      if (list.length === 0) {
        if (empty) empty.classList.remove('hidden');
      } else {
        list.forEach(restaurant => {
          const card = createRestaurantCard(restaurant, favIds);
          grid.appendChild(card);
        });
      }
    }
  } catch (err) {
    console.error('Lỗi tải danh sách yêu thích:', err);
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-rose-500 font-medium">
        Không thể tải danh sách quán yêu thích. Vui lòng thử lại.
      </div>
    `;
  }
}

function checkEmpty() {
  const grid = document.getElementById('fav-grid');
  const empty = document.getElementById('fav-empty');
  const totalText = document.getElementById('fav-total-text');

  if (grid && empty) {
    const count = grid.children.length;
    if (totalText) totalText.textContent = `${count} quán đã lưu`;
    if (count === 0) {
      empty.classList.remove('hidden');
    }
  }
}
