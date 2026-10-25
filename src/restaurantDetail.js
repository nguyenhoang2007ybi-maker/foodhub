// FoodHub Restaurant Detail Controller
import { api } from './api.js';
import { toast } from './toast.js';
import { initHeader, initFooter, getUser, isLoggedIn, updateFavoritesBadge } from './auth.js';
import { createRestaurantCard } from './components/restaurantCard.js';
import { addToCart, replaceCartWithDish, formatVND } from './cart.js';

let currentRestaurant = null;
let selectedStar = 5;
let isFav = false;
let favoriteIds = [];
let editingReviewId = null;
let reviewModalController = null;

const starLabels = {
  1: '1 sao - Rất tệ',
  2: '2 sao - Tệ',
  3: '3 sao - Bình thường',
  4: '4 sao - Tốt',
  5: '5 sao - Tuyệt vời'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chuyển chuỗi giá kiểu Việt Nam ("75.000đ", "10.000đ/cặp", "650.000đ/set")
// thành số nguyên. Dấu chấm là phân cách hàng nghìn nên phải loại bỏ trước khi
// parse — không dùng trực tiếp Number()/parseFloat() vì sẽ ra NaN hoặc 75.
function parsePriceNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }
  if (value === null || value === undefined) return 0;
  const digits = String(value).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

// Hiển thị giá món ăn: ưu tiên trường priceNum, nếu không có thì bóc tách từ
// chuỗi price. Giữ lại hậu tố đơn vị (ví dụ "/cặp", "/set") để không mất thông tin.
function formatDishPrice(item) {
  if (!item) return 'Liên hệ';

  if (typeof item.priceNum === 'number' && Number.isFinite(item.priceNum) && item.priceNum > 0) {
    return formatVND(item.priceNum);
  }

  const raw = item.price;
  if (raw === null || raw === undefined || raw === '') return 'Liên hệ';

  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? formatVND(raw) : 'Liên hệ';
  }

  const text = String(raw).trim();
  const amount = parsePriceNumber(text);
  if (amount <= 0) return text || 'Liên hệ';

  const suffix = text.replace(/^[\d.,\s]+/, '').replace(/^đ\s*/i, '');
  return formatVND(amount) + suffix;
}

// Hiển thị giờ mở cửa: ưu tiên dữ liệu mới (openingTime/closingTime/open24),
// fallback về openingHours của dữ liệu cũ để không làm mất thông tin quán ăn cũ.
function formatOpeningHours(restaurant) {
  if (!restaurant) return '06:00 - 22:00';
  if (restaurant.open24 === true || /24\s*\/\s*24/i.test(String(restaurant.openingHours || ''))) {
    return 'Mở cửa 24/24';
  }
  if (restaurant.openingTime && restaurant.closingTime) {
    return `${restaurant.openingTime} - ${restaurant.closingTime}`;
  }
  return restaurant.openingHours || '06:00 - 22:00';
}

function showSkeleton() {
  const skeleton = document.getElementById('detail-skeleton');
  const content = document.getElementById('detail-content');
  const errorBox = document.getElementById('detail-error');
  if (skeleton) skeleton.classList.remove('hidden');
  if (errorBox) errorBox.classList.add('hidden');
  if (content) content.classList.add('hidden');
}

function showContent() {
  const skeleton = document.getElementById('detail-skeleton');
  const content = document.getElementById('detail-content');
  const errorBox = document.getElementById('detail-error');
  if (skeleton) skeleton.classList.add('hidden');
  if (errorBox) errorBox.classList.add('hidden');
  if (content) content.classList.remove('hidden');
}

// Thoát khỏi trạng thái loading và hiển thị thông báo lỗi rõ ràng.
// Không dùng dữ liệu giả — chỉ hiện thông tin lỗi thật từ API.
function showErrorState({ title, message, icon = 'cloud_off' }) {
  const skeleton = document.getElementById('detail-skeleton');
  const content = document.getElementById('detail-content');
  const errorBox = document.getElementById('detail-error');

  if (skeleton) skeleton.classList.add('hidden');
  if (content) content.classList.add('hidden');

  if (!errorBox) {
    toast.error(message || title);
    return;
  }

  const titleEl = document.getElementById('detail-error-title');
  const msgEl = document.getElementById('detail-error-message');
  const iconEl = document.querySelector('#detail-error-icon .material-symbols-outlined');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (iconEl) iconEl.textContent = icon;
  errorBox.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  initHeader('');
  initFooter();

  const urlParams = new URLSearchParams(window.location.search);
  const rawId = urlParams.get('id');
  const restId = rawId !== null && /^\d+$/.test(rawId.trim()) ? Number(rawId.trim()) : NaN;

  const retryBtn = document.getElementById('detail-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (!Number.isInteger(restId)) {
        window.location.href = '/explore.html';
        return;
      }
      initPage(restId);
    });
  }

  if (!Number.isInteger(restId) || restId <= 0) {
    showErrorState({
      title: 'Đường dẫn không hợp lệ',
      message: 'Không tìm thấy mã quán ăn trong đường dẫn. Vui lòng chọn một quán từ trang Khám phá.',
      icon: 'link_off'
    });
    return;
  }

  await initPage(restId);
});

async function initPage(restId) {
  showSkeleton();

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

  const loaded = await loadRestaurantDetail(restId);
  if (loaded) {
    setupReviewModal(restId);
  }
}

async function loadRestaurantDetail(id) {
  try {
    const res = await api.get(`/restaurants/${id}?_t=${Date.now()}`);
    if (!res || !res.success || !res.data) {
      showErrorState({
        title: 'Quán ăn không tồn tại',
        message: (res && res.message) || 'Quán ăn này không tồn tại hoặc đã bị xóa.',
        icon: 'search_off'
      });
      return false;
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
    if (hoursEl) hoursEl.textContent = formatOpeningHours(currentRestaurant);

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

    // Render Google Maps (Chỉ nhúng trên trang chi tiết quán ăn)
    renderGoogleMaps(currentRestaurant);

    // Render Menu
    renderMenu(currentRestaurant.menu);

    // Render Reviews
    renderReviews(currentRestaurant.reviews);

    // Render Related
    renderRelated(currentRestaurant.related);

    // Show Content
    showContent();
    return true;

  } catch (err) {
    console.error('Lỗi khi tải chi tiết quán ăn:', err);

    const status = err && typeof err.status === 'number' ? err.status : 0;

    if (status === 404) {
      showErrorState({
        title: 'Quán ăn không tồn tại',
        message: err.message || 'Không tìm thấy thông tin quán ăn.',
        icon: 'search_off'
      });
    } else if (status === 0) {
      showErrorState({
        title: 'Không kết nối được máy chủ',
        message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend có đang chạy ở cổng 3000 không.',
        icon: 'wifi_off'
      });
    } else {
      showErrorState({
        title: 'Không tải được thông tin quán ăn',
        message: err.message || `Đã xảy ra lỗi khi tải dữ liệu (Mã: ${status}). Vui lòng thử lại.`,
        icon: 'error'
      });
    }
    return false;
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

// Tạo URL nhúng Google Maps KHÔNG cần API key từ địa chỉ/tên của quán ăn.
// Hàm này chỉ được gọi trên trang chi tiết quán ăn (trang chủ không gọi).
function resolveGoogleMapsUrls(restaurant) {
  const empty = { embedUrl: '', directUrl: '' };
  if (!restaurant) return empty;

  const name = String(restaurant.name || '').trim();
  const address = String(restaurant.address || '').trim();

  // Admin có thể đã dán sẵn link Google Maps (hoặc cả thẻ <iframe>) -> ưu tiên dùng.
  let raw = String(restaurant.mapUrl || '').trim();
  if (raw && /<iframe/i.test(raw)) {
    const srcMatch = raw.match(/src=["']([^"']+)["']/i);
    raw = srcMatch && srcMatch[1] ? srcMatch[1].trim() : '';
  }

  const query = [name, address].filter(Boolean).join(', ');

  // 1. Không có link tùy chỉnh -> dựng bản đồ từ địa chỉ của quán.
  // Thiếu địa chỉ thì trả về rỗng để hiển thị thông báo thay vì bản đồ sai.
  if (!raw) {
    if (!address) return empty;
    const q = query || address;
    return {
      embedUrl: `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`,
      directUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    };
  }

  // 2. Link đã ở dạng nhúng sẵn của Google Maps.
  if (raw.includes('/maps/embed') || (raw.includes('/maps?') && raw.includes('output=embed'))) {
    return {
      embedUrl: raw,
      directUrl: query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : raw
    };
  }

  // 3. Link Google Maps thông thường -> trích xuất địa điểm/query.
  let extractedQuery = '';
  try {
    const parsed = new URL(raw);
    extractedQuery = parsed.searchParams.get('q') || parsed.searchParams.get('query') || '';
    if (!extractedQuery && parsed.pathname.includes('/maps/place/')) {
      const placeSegment = parsed.pathname.split('/maps/place/')[1];
      if (placeSegment) {
        extractedQuery = decodeURIComponent(placeSegment.split('/')[0]).replace(/\+/g, ' ');
      }
    }
  } catch (e) {
    // Không phải URL hợp lệ -> coi như Admin nhập trực tiếp địa chỉ hoặc tọa độ.
    extractedQuery = raw;
  }

  const queryToUse = extractedQuery || query || raw;
  return {
    embedUrl: `https://www.google.com/maps?q=${encodeURIComponent(queryToUse)}&z=15&output=embed`,
    directUrl: raw.startsWith('http') ? raw : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryToUse)}`
  };
}

function renderGoogleMaps(restaurant) {
  const container = document.getElementById('rest-map-container');
  const mapIframe = document.getElementById('rest-map-iframe');
  const mapFallback = document.getElementById('rest-map-fallback');
  const externalLink = document.getElementById('rest-map-external-link');

  // Chỉ tồn tại trên trang chi tiết quán ăn -> đảm bảo không chạy ở trang chủ.
  if (!container || !mapIframe) return;

  const { embedUrl, directUrl } = resolveGoogleMapsUrls(restaurant);

  if (!embedUrl) {
    mapIframe.removeAttribute('src');
    mapIframe.classList.add('hidden');
    if (mapFallback) mapFallback.classList.remove('hidden');
    if (externalLink) externalLink.classList.add('hidden');
    container.classList.remove('hidden');
    return;
  }

  mapIframe.src = embedUrl;
  mapIframe.classList.remove('hidden');
  if (mapFallback) mapFallback.classList.add('hidden');
  container.classList.remove('hidden');

  if (externalLink) {
    if (directUrl) {
      externalLink.href = directUrl;
      externalLink.classList.remove('hidden');
    } else {
      externalLink.removeAttribute('href');
      externalLink.classList.add('hidden');
    }
  }
}

let pendingConflictItem = null;

function setupCartConflictModal() {
  const modal = document.getElementById('cart-conflict-modal');
  const cancelBtn = document.getElementById('cancel-conflict-btn');
  const confirmBtn = document.getElementById('confirm-conflict-btn');

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      pendingConflictItem = null;
      if (modal) modal.classList.add('hidden');
    };
  }

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (pendingConflictItem && currentRestaurant) {
        replaceCartWithDish(pendingConflictItem, currentRestaurant, 1);
        toast.success(`Đã làm mới giỏ hàng và thêm "${pendingConflictItem.name}"!`);
        pendingConflictItem = null;
      }
      if (modal) modal.classList.add('hidden');
    };
  }
}

function renderMenu(menuItems) {
  const container = document.getElementById('rest-menu-grid');
  const section = document.getElementById('rest-menu-container');
  if (!container) return;

  setupCartConflictModal();

  if (!Array.isArray(menuItems) || menuItems.length === 0) {
    if (section) section.classList.add('hidden');
    return;
  }

  container.innerHTML = '';
  menuItems.forEach((item, idx) => {
    // Đảm bảo item.id và item.priceNum luôn là số nguyên hợp lệ, không bao giờ là NaN
    const rawId = item.id !== undefined ? item.id : (item.dishId !== undefined ? item.dishId : (item.foodId || item.menuItemId));
    const validDishId = (rawId !== null && rawId !== undefined && !isNaN(Number(rawId)))
      ? Number(rawId)
      : (currentRestaurant ? (Number(currentRestaurant.id) * 100 + (idx + 1)) : (idx + 1));
    item.id = validDishId;
    item.dishId = validDishId;

    const parsedPrice = parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10);
    if (!item.priceNum || item.priceNum <= 0) {
      item.priceNum = parsedPrice > 0 ? parsedPrice : 35000;
    }

    const el = document.createElement('div');
    const isOutOfStock = item.isAvailable === false;
    el.className = 'flex items-center gap-3 p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high hover:border-primary-container/40 hover:shadow-sm transition-all group';
    el.innerHTML = `
      <div class="w-16 h-16 rounded-xl overflow-hidden bg-surface-container-high flex-shrink-0 relative">
        <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}" alt="${item.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ${isOutOfStock ? `<div class="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-wider">Hết</div>` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-xs font-bold text-on-surface truncate">${item.name}</h4>
        ${item.description ? `<p class="text-[11px] text-secondary truncate mt-0.5" title="${item.description}">${item.description}</p>` : ''}
        <p class="text-xs font-bold text-primary mt-1">${formatDishPrice(item)}</p>
      </div>
      <div class="flex-shrink-0">
        ${isOutOfStock ? `
          <span class="px-2.5 py-1 text-[11px] font-semibold text-secondary/60 bg-surface-container-high rounded-lg cursor-not-allowed">Hết hàng</span>
        ` : `
          <button type="button" class="add-to-cart-btn h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95" data-dish-id="${item.id}">
            <span class="material-symbols-outlined text-[16px]">add_shopping_cart</span>
            <span class="hidden sm:inline">Thêm</span>
          </button>
        `}
      </div>
    `;

    const addBtn = el.querySelector('.add-to-cart-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (!currentRestaurant) return;
        const res = addToCart(item, currentRestaurant, 1);
        if (res.conflict) {
          pendingConflictItem = item;
          const curRestEl = document.getElementById('conflict-current-restaurant');
          const newRestEl = document.getElementById('conflict-new-restaurant');
          if (curRestEl) curRestEl.textContent = res.currentRestaurant.name;
          if (newRestEl) newRestEl.textContent = res.newRestaurant.name;
          const modal = document.getElementById('cart-conflict-modal');
          if (modal) modal.classList.remove('hidden');
        } else {
          toast.success(`Đã thêm "${item.name}" vào giỏ hàng!`);
        }
      });
    }

    container.appendChild(el);
  });
}

function formatReviewTime(review) {
  const iso = review.createdAt || review.updatedAt || review.date;
  if (!iso) return 'Gần đây';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return review.date || 'Gần đây';
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
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
    const isOwner = currentUser && (Number(currentUser.id) === Number(rev.userId) || currentUser.role === 'admin');
    const revEl = document.createElement('div');
    revEl.className = 'p-5 rounded-2xl bg-surface-container-low border border-surface-container-high transition-all flex flex-col gap-3';
    revEl.id = `review-${rev.id}`;

    // Stars
    let starsHtml = '';
    const ratingNum = Math.round(Number(rev.rating) || 5);
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="material-symbols-outlined text-[16px] ${i <= ratingNum ? 'text-amber-500' : 'text-secondary/30'}" style="${i <= ratingNum ? "font-variation-settings: 'FILL' 1;" : ''}">star</span>`;
    }

    const reviewerName = rev.userName || rev.user_name || rev.name || 'Người dùng';
    const avatar = rev.userAvatar || rev.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=ff6b35&color=fff`;

    revEl.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <img src="${avatar}" alt="${escapeHtml(reviewerName)}" class="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20" />
          <div>
            <h4 class="text-xs font-bold text-on-surface">${escapeHtml(reviewerName)}</h4>
            <div class="flex items-center gap-2 mt-0.5">
              <div class="flex items-center">${starsHtml}</div>
              <span class="text-[11px] text-secondary">• ${formatReviewTime(rev)}</span>
            </div>
          </div>
        </div>

        ${isOwner ? `
          <div class="flex items-center gap-1">
            <button class="edit-rev-btn text-primary hover:text-primary-container text-xs font-semibold p-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer" data-id="${rev.id}" title="Chỉnh sửa đánh giá của bạn">
              <span class="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button class="delete-rev-btn text-rose-500 hover:text-rose-700 text-xs font-semibold p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" data-id="${rev.id}" title="Xóa đánh giá của bạn">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ` : ''}
      </div>

      <p class="text-xs text-on-surface-variant leading-relaxed pl-13">
        ${escapeHtml(rev.content || rev.comment || '')}
      </p>
    `;

    // Bind edit review
    const editBtn = revEl.querySelector('.edit-rev-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        if (reviewModalController) reviewModalController.openForEdit(rev);
      });
    }

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
      toast.success(res.message || 'Đã xóa đánh giá thành công.');
      // Cập nhật state in-memory ngay lập tức
      if (currentRestaurant && Array.isArray(currentRestaurant.reviews)) {
        currentRestaurant.reviews = currentRestaurant.reviews.filter(r => r.id !== Number(reviewId));
        currentRestaurant.reviewsCount = currentRestaurant.reviews.length;
        renderReviews(currentRestaurant.reviews);
        const countEl = document.getElementById('rest-reviews-count');
        if (countEl) countEl.textContent = `(${currentRestaurant.reviewsCount} nhận xét)`;
      }
      // Tải lại chi tiết quán từ backend để đồng bộ điểm số
      await loadRestaurantDetail(currentRestaurant.id);
    }
  } catch (err) {
    toast.error(err.message || 'Lỗi khi xóa đánh giá.');
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

  reviewModalController = {
    openForCreate() {
      editingReviewId = null;
      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) modalTitle.textContent = 'Đánh giá quán ăn';
      const submitBtn = document.getElementById('submit-review-btn');
      if (submitBtn) submitBtn.textContent = 'Gửi nhận xét';
      if (contentInput) contentInput.value = '';
      updateStars(5);
      openModal();
    },
    openForEdit(rev) {
      if (!isLoggedIn()) {
        toast.warning('Vui lòng đăng nhập để chỉnh sửa đánh giá.');
        return;
      }
      editingReviewId = rev.id;
      const modalTitle = document.getElementById('modal-title');
      if (modalTitle) modalTitle.textContent = 'Chỉnh sửa đánh giá của bạn';
      const submitBtn = document.getElementById('submit-review-btn');
      if (submitBtn) submitBtn.textContent = 'Lưu thay đổi';
      if (contentInput) contentInput.value = rev.content || '';
      updateStars(Math.round(Number(rev.rating) || 5));
      openModal();
    }
  };

  if (openBtn) openBtn.addEventListener('click', () => reviewModalController.openForCreate());
  if (openBtn2) openBtn2.addEventListener('click', () => reviewModalController.openForCreate());
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
        let res;
        if (editingReviewId) {
          res = await api.put(`/reviews/${editingReviewId}`, {
            rating: selectedStar,
            content
          });
          if (res && res.success) {
            toast.success(res.message || 'Cập nhật đánh giá thành công!');
            closeModal();
            contentInput.value = '';
            editingReviewId = null;

            // Cập nhật state in-memory ngay lập tức
            if (res.data && currentRestaurant && Array.isArray(currentRestaurant.reviews)) {
              const idx = currentRestaurant.reviews.findIndex(r => r.id === res.data.id);
              if (idx !== -1) {
                currentRestaurant.reviews[idx] = res.data;
              }
              renderReviews(currentRestaurant.reviews);
            }

            await loadRestaurantDetail(restId);
            return;
          }
        }
        res = await api.post('/reviews', {
          restaurantId: Number(restId),
          rating: selectedStar,
          content
        });

        if (res && res.success) {
          toast.success(res.message || 'Cảm ơn nhận xét của bạn! Đánh giá đã được hiển thị công khai.');
          closeModal();
          contentInput.value = '';

          // 1. Cập nhật ngay lập tức danh sách in-memory và render ngay
          if (res.data && currentRestaurant) {
            if (!Array.isArray(currentRestaurant.reviews)) {
              currentRestaurant.reviews = [];
            }
            currentRestaurant.reviews = currentRestaurant.reviews.filter(r => r.id !== res.data.id);
            currentRestaurant.reviews.unshift(res.data);
            currentRestaurant.reviewsCount = currentRestaurant.reviews.length;
            renderReviews(currentRestaurant.reviews);
            const countEl = document.getElementById('rest-reviews-count');
            if (countEl) countEl.textContent = `(${currentRestaurant.reviewsCount} nhận xét)`;
          }

          // 2. Đồng bộ đầy đủ với backend
          await loadRestaurantDetail(restId);
          document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {
        toast.error(err.message || 'Không thể gửi đánh giá.');
      }
    });
  }
}
