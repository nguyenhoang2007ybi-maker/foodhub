// FoodHub Restaurant Detail Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, getUser, isLoggedIn, updateFavoritesBadge } from './auth.js';
import { createRestaurantCard } from './components/restaurantCard.js';

let currentRestaurant = null;
let selectedStar = 5;
let isFav = false;
let favoriteIds = [];

const starLabels = {
  1: '1 sao - Rất tệ',
  2: '2 sao - Tệ',
  3: '3 sao - Bình thường',
  4: '4 sao - Tốt',
  5: '5 sao - Tuyệt vời'
};

document.addEventListener('DOMContentLoaded', async () => {
  initHeader('');
  initFooter();

  const urlParams = new URLSearchParams(window.location.search);
  const restId = urlParams.get('id');

  if (!restId) {
    toast.error('Không tìm thấy mã quán ăn.');
    setTimeout(() => window.location.href = '/explore.html', 1000);
    return;
  }

  // Load user favorites
  if (isLoggedIn()) {
    try {
      const favRes = await api.get('/favorites/ids');
      if (favRes && favRes.success && Array.isArray(favRes.data)) {
        favoriteIds = favRes.data;
        isFav = favoriteIds.includes(Number(restId));
      }
    } catch (e) {
      console.warn('Could not load favorites', e);
    }
  }

  await loadRestaurantDetail(restId);
  setupReviewModal(restId);
});

async function loadRestaurantDetail(id) {
  const skeleton = document.getElementById('detail-skeleton');
  const content = document.getElementById('detail-content');

  try {
    const res = await api.get(`/restaurants/${id}`);
    if (!res || !res.success || !res.data) {
      toast.error('Quán ăn không tồn tại hoặc đã bị xóa.');
      setTimeout(() => window.location.href = '/explore.html', 1500);
      return;
    }

    currentRestaurant = res.data;
    document.title = `${currentRestaurant.name} - FoodHub`;

    // Populate Breadcrumb
    const breadcrumbName = document.getElementById('breadcrumb-rest-name');
    if (breadcrumbName) breadcrumbName.textContent = currentRestaurant.name;

    // Populate Main Info
    const mainImg = document.getElementById('rest-main-image');
    if (mainImg) {
      mainImg.src = currentRestaurant.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80';
      mainImg.alt = currentRestaurant.name;
    }

    const catBadge = document.getElementById('rest-category-badge');
    if (catBadge) catBadge.textContent = currentRestaurant.category || 'Ẩm thực';

    const areaBadge = document.getElementById('rest-area-badge');
    if (areaBadge) areaBadge.textContent = currentRestaurant.area || 'Hà Nội';

    const nameEl = document.getElementById('rest-name');
    if (nameEl) nameEl.textContent = currentRestaurant.name;

    const descEl = document.getElementById('rest-description');
    if (descEl) descEl.textContent = currentRestaurant.description || 'Không gian ẩm thực ấn tượng với hương vị đậm đà thơm ngon.';

    const addrEl = document.getElementById('rest-address');
    if (addrEl) addrEl.textContent = currentRestaurant.address || 'Hà Nội';

    const priceEl = document.getElementById('rest-price');
    if (priceEl) priceEl.textContent = currentRestaurant.price || '30.000đ - 100.000đ';

    const hoursEl = document.getElementById('rest-hours');
    if (hoursEl) hoursEl.textContent = currentRestaurant.openingHours || '06:00 - 22:00';

    const phoneEl = document.getElementById('rest-phone');
    if (phoneEl) phoneEl.textContent = currentRestaurant.phone || '0901234567';

    const ratingEl = document.getElementById('rest-rating');
    if (ratingEl) ratingEl.textContent = Number(currentRestaurant.rating || 0).toFixed(1);

    const countEl = document.getElementById('rest-reviews-count');
    if (countEl) countEl.textContent = `(${currentRestaurant.reviewsCount || 0} nhận xét)`;

    // Gallery Thumbs
    const thumbsContainer = document.getElementById('rest-gallery-thumbs');
    if (thumbsContainer && Array.isArray(currentRestaurant.gallery) && currentRestaurant.gallery.length > 0) {
      thumbsContainer.innerHTML = '';
      currentRestaurant.gallery.slice(0, 4).forEach(thumbUrl => {
        const thumb = document.createElement('div');
        thumb.className = 'aspect-[16/10] rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary transition-all';
        thumb.innerHTML = `<img src="${thumbUrl}" alt="Ảnh phụ" class="w-full h-full object-cover" />`;
        thumb.addEventListener('click', () => {
          if (mainImg) mainImg.src = thumbUrl;
        });
        thumbsContainer.appendChild(thumb);
      });
    }

    // Favorite Button state
    updateFavButtonUI();
    const favBtn = document.getElementById('rest-fav-btn');
    if (favBtn) {
      favBtn.onclick = handleFavToggle;
    }

    // Render Menu
    renderMenu(currentRestaurant.menu);

    // Render Reviews
    renderReviews(currentRestaurant.reviews);

    // Render Related
    renderRelated(currentRestaurant.related);

    // Show Content
    if (skeleton) skeleton.classList.add('hidden');
    if (content) content.classList.remove('hidden');

  } catch (err) {
    console.error('Lỗi khi tải chi tiết quán ăn:', err);
    toast.error('Không thể nạp thông tin quán ăn.');
  }
}

function updateFavButtonUI() {
  const favBtn = document.getElementById('rest-fav-btn');
  if (!favBtn) return;
  const icon = favBtn.querySelector('.material-symbols-outlined');
  if (isFav) {
    icon.classList.remove('text-secondary');
    icon.classList.add('text-rose-500');
    icon.style.fontVariationSettings = "'FILL' 1";
  } else {
    icon.classList.remove('text-rose-500');
    icon.classList.add('text-secondary');
    icon.style.fontVariationSettings = '';
  }
}

async function handleFavToggle() {
  if (!isLoggedIn()) {
    toast.warning('Vui lòng đăng nhập để lưu quán ăn này.');
    setTimeout(() => {
      window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 800);
    return;
  }

  try {
    const res = await api.post('/favorites/toggle', { restaurantId: currentRestaurant.id });
    if (res && res.success) {
      isFav = res.isFavorite;
      updateFavButtonUI();
      updateFavoritesBadge();
      if (isFav) toast.success(`Đã thêm "${currentRestaurant.name}" vào danh sách yêu thích!`);
      else toast.info(`Đã bỏ lưu "${currentRestaurant.name}".`);
    }
  } catch (err) {
    toast.error('Lỗi cập nhật yêu thích.');
  }
}

function renderMenu(menuItems) {
  const container = document.getElementById('rest-menu-grid');
  const section = document.getElementById('rest-menu-container');
  if (!container) return;

  if (!Array.isArray(menuItems) || menuItems.length === 0) {
    if (section) section.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  menuItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-3 p-3 rounded-2xl bg-surface-container-low border border-surface-container-high hover:border-primary-container/30 transition-all';
    el.innerHTML = `
      <div class="w-14 h-14 rounded-xl overflow-hidden bg-surface-container-high flex-shrink-0">
        <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}" alt="${item.name}" class="w-full h-full object-cover" />
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-bold text-on-surface truncate">${item.name}</h4>
        <p class="text-xs font-bold text-primary mt-0.5">${item.price || 'Liên hệ'}</p>
      </div>
    `;
    container.appendChild(el);
  });
}

function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  if (!list) return;

  if (!Array.isArray(reviews) || reviews.length === 0) {
    list.innerHTML = `
      <div class="text-center py-8 text-secondary text-xs">
        <span class="material-symbols-outlined text-3xl mb-1 text-secondary/40">forum</span>
        <p>Chưa có đánh giá nào cho quán ăn này. Hãy là người đầu tiên chia sẻ cảm nhận!</p>
      </div>
    `;
    return;
  }

  const currentUser = getUser();

  list.innerHTML = '';
  reviews.forEach(rev => {
    const isOwner = currentUser && (currentUser.id === rev.userId || currentUser.role === 'admin');
    const revEl = document.createElement('div');
    revEl.className = 'p-5 rounded-2xl bg-surface-container-low border border-surface-container-high transition-all flex flex-col gap-3';
    revEl.id = `review-${rev.id}`;

    // Stars
    let starsHtml = '';
    const ratingNum = Math.round(Number(rev.rating) || 5);
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="material-symbols-outlined text-[16px] ${i <= ratingNum ? 'text-amber-500' : 'text-secondary/30'}" style="${i <= ratingNum ? "font-variation-settings: 'FILL' 1;" : ''}">star</span>`;
    }

    const avatar = rev.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(rev.userName || 'U')}&background=ff6b35&color=fff`;

    revEl.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <img src="${avatar}" alt="${rev.userName}" class="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
          <div>
            <h4 class="text-xs font-bold text-on-surface">${rev.userName}</h4>
            <div class="flex items-center gap-2 mt-0.5">
              <div class="flex items-center">${starsHtml}</div>
              <span class="text-[11px] text-secondary">• ${rev.date || 'Gần đây'}</span>
            </div>
          </div>
        </div>

        ${isOwner ? `
          <div class="flex items-center gap-1">
            <button class="delete-rev-btn text-rose-500 hover:text-rose-700 text-xs font-semibold p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" data-id="${rev.id}">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ` : ''}
      </div>

      <p class="text-xs text-on-surface-variant leading-relaxed pl-13">
        ${rev.content}
      </p>
    `;

    // Bind delete review
    const delBtn = revEl.querySelector('.delete-rev-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => handleDeleteReview(rev.id));
    }

    list.appendChild(revEl);
  });
}

async function handleDeleteReview(reviewId) {
  if (!confirm('Bạn có chắc chắn muốn xóa đánh giá này không?')) return;

  try {
    const res = await api.delete(`/reviews/${reviewId}`);
    if (res && res.success) {
      toast.success('Đã xóa đánh giá thành công.');
      // Reload restaurant info to update stars & reviews list
      await loadRestaurantDetail(currentRestaurant.id);
    }
  } catch (err) {
    toast.error('Lỗi khi xóa đánh giá.');
  }
}

function renderRelated(related) {
  const container = document.getElementById('related-grid');
  if (!container) return;

  if (!Array.isArray(related) || related.length === 0) {
    container.parentElement.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  related.forEach(rest => {
    const card = createRestaurantCard(rest, favoriteIds);
    container.appendChild(card);
  });
}

function setupReviewModal(restId) {
  const modal = document.getElementById('review-modal');
  const openBtn = document.getElementById('open-review-modal-btn');
  const openBtn2 = document.getElementById('write-review-btn-section');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const form = document.getElementById('review-form');
  const starBtns = document.querySelectorAll('.star-btn');
  const starLabel = document.getElementById('star-label');
  const contentInput = document.getElementById('review-content');

  const openModal = () => {
    if (!isLoggedIn()) {
      toast.warning('Vui lòng đăng nhập để viết đánh giá.');
      setTimeout(() => {
        window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }, 800);
      return;
    }
    modal.classList.remove('hidden');
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (openBtn2) openBtn2.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Star selector
  const updateStars = (val) => {
    selectedStar = val;
    starBtns.forEach(btn => {
      const star = parseInt(btn.dataset.star, 10);
      const icon = btn.querySelector('.material-symbols-outlined');
      if (star <= val) {
        btn.classList.add('text-amber-400');
        btn.classList.remove('text-secondary/30');
        icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        btn.classList.remove('text-amber-400');
        btn.classList.add('text-secondary/30');
        icon.style.fontVariationSettings = '';
      }
    });
    if (starLabel) starLabel.textContent = starLabels[val] || `${val} sao`;
  };

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.star, 10);
      updateStars(val);
    });
  });

  // Submit review
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = contentInput.value.trim();

      if (content.length < 5) {
        toast.warning('Nội dung nhận xét tối thiểu 5 ký tự.');
        return;
      }

      try {
        const res = await api.post('/reviews', {
          restaurantId: Number(restId),
          rating: selectedStar,
          content
        });

        if (res && res.success) {
          toast.success(res.message || 'Cảm ơn nhận xét của bạn!');
          closeModal();
          contentInput.value = '';
          // Reload restaurant to see updated rating & review list
          await loadRestaurantDetail(restId);
        }
      } catch (err) {
        toast.error(err.message || 'Không thể gửi đánh giá.');
      }
    });
  }
}
