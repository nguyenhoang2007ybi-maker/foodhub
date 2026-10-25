// FoodHub Authentication & Layout Helpers
import { api } from './api.js';
import { toast } from './toast.js';
import { updateCartBadge, loadCartFromServer } from './cart.js';

export function getToken() {
  return localStorage.getItem('foodhub_token');
}

export function setToken(token) {
  localStorage.setItem('foodhub_token', token);
}

export function removeToken() {
  localStorage.removeItem('foodhub_token');
}

export function getUser() {
  try {
    const raw = localStorage.getItem('foodhub_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem('foodhub_user', JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem('foodhub_user');
}

export function isLoggedIn() {
  return Boolean(getToken() && getUser());
}

export function isAdmin() {
  const user = getUser();
  return Boolean(user && user.role === 'admin');
}

export function isRestaurant() {
  const user = getUser();
  return Boolean(user && ['restaurant', 'restaurant_owner', 'restaurant_manager'].includes(user.role));
}

export function logout() {
  removeToken();
  removeUser();
  toast.success('Đã đăng xuất thành công.');
  setTimeout(() => {
    window.location.href = '/index.html';
  }, 500);
}

// Cập nhật số lượng yêu thích trên header badge
export async function updateFavoritesBadge() {
  const badgeEl = document.getElementById('header-fav-count');
  if (!badgeEl) return;

  if (!isLoggedIn()) {
    badgeEl.textContent = '0';
    return;
  }

  try {
    const res = await api.get('/favorites/ids');
    if (res && res.success && Array.isArray(res.data)) {
      badgeEl.textContent = res.data.length;
    }
  } catch (e) {
    // Silent fail in background
  }
}

// Khởi tạo Header chuẩn thống nhất toàn bộ trang
export function initHeader(activeNav = '') {
  const headerContainer = document.querySelector('header');
  if (!headerContainer) return;

  const user = getUser();
  const logged = isLoggedIn();
  const adminRole = isAdmin();
  const restaurantRole = isRestaurant();

  const getActiveCls = (key) => activeNav === key 
    ? 'text-primary font-bold border-b-2 border-primary-container pb-1' 
    : 'text-on-surface-variant hover:text-on-surface transition-colors pb-1';

  headerContainer.className = 'sticky top-0 z-50 w-full bg-surface-container-lowest/95 backdrop-blur border-b border-surface-container-high transition-all';
  headerContainer.innerHTML = `
    <div class="h-[72px] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      <!-- Logo & Navigation -->
      <div class="flex items-center gap-6 lg:gap-8 flex-shrink-0">
        <a class="flex items-center gap-1.5 text-decoration-none group" href="/index.html">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white shadow-sm shadow-primary/20 group-hover:scale-105 transition-transform">
            <span class="material-symbols-outlined text-[20px]">restaurant</span>
          </div>
          <div class="flex items-center text-2xl font-black tracking-tight">
            <span class="text-primary">Food</span><span class="text-on-surface">Hub</span>
          </div>
        </a>

        <nav class="hidden md:flex items-center gap-6">
          <a class="text-sm font-semibold ${getActiveCls('home')}" href="/index.html">Trang chủ</a>
          <a class="text-sm font-semibold ${getActiveCls('explore')}" href="/explore.html">Khám phá</a>
          <a class="text-sm font-semibold ${getActiveCls('favorites')} relative flex items-center gap-1.5" href="/favorites.html">
            <span>Yêu thích</span>
            <span id="header-fav-count" class="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold bg-primary-container text-on-primary rounded-full min-w-[20px] text-center leading-none">0</span>
          </a>
          <a class="text-sm font-semibold ${getActiveCls('cart')} relative flex items-center gap-1.5" href="/cart.html">
            <span class="material-symbols-outlined text-[18px]">shopping_bag</span>
            <span>Giỏ hàng</span>
            <span id="header-cart-count" class="header-cart-badge inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold bg-primary text-white rounded-full min-w-[20px] text-center leading-none">0</span>
          </a>
          ${restaurantRole ? `<a class="text-sm font-semibold ${getActiveCls('restaurant')} text-emerald-700 hover:text-emerald-800 flex items-center gap-1" href="/restaurant.html"><span class="material-symbols-outlined text-[16px]">storefront</span>Quản lý quán</a>` : ''}
          ${adminRole ? `<a class="text-sm font-semibold ${getActiveCls('admin')} text-amber-600 hover:text-amber-700 flex items-center gap-1" href="/admin.html"><span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>Quản trị</a>` : ''}
        </nav>
      </div>

      <!-- Quick Global Search Bar -->
      <div class="flex-1 max-w-md hidden sm:block">
        <form id="header-search-form" class="relative flex items-center w-full" action="/explore.html" method="GET">
          <span class="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">search</span>
          <input
            id="header-search-input"
            name="q"
            class="w-full h-10 pl-10 pr-4 bg-surface-container-low border border-surface-container-high rounded-full text-sm text-on-surface placeholder:text-secondary focus:outline-none focus:border-primary-container focus:bg-surface-container-lowest transition-all"
            placeholder="Tìm quán ăn, món ngon, địa điểm..."
            type="search"
          />
        </form>
      </div>

      <!-- Action buttons & Auth profile -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <a href="/explore.html" class="hidden lg:inline-flex items-center gap-1.5 h-9 px-3.5 bg-primary-container/10 hover:bg-primary-container text-primary hover:text-on-primary font-semibold text-xs rounded-full transition-all">
          <span class="material-symbols-outlined text-[16px]">add_location_alt</span>
          <span>Khám phá ngay</span>
        </a>

        ${logged ? `
          <!-- Logged In User Dropdown -->
          <div class="relative" id="user-menu-wrapper">
            <button id="user-menu-btn" type="button" class="flex items-center gap-2 p-1 rounded-full hover:bg-surface-container-low transition-colors cursor-pointer border border-transparent hover:border-surface-container-high">
              <img
                src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=ff6b35&color=fff`}"
                alt="${user.name}"
                class="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
              />
              <span class="hidden md:inline-block text-xs font-semibold text-on-surface max-w-[100px] truncate">${user.name}</span>
              <span class="material-symbols-outlined text-[16px] text-secondary">expand_more</span>
            </button>

            <!-- Dropdown Menu -->
            <div id="user-dropdown" class="hidden absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div class="px-4 py-2.5 border-b border-surface-container-high">
                <p class="text-xs text-secondary">Đăng nhập với</p>
                <p class="text-sm font-bold text-on-surface truncate">${user.name}</p>
                <div class="mt-1 flex items-center gap-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${user.role === 'admin' ? 'bg-amber-100 text-amber-800' : restaurantRole ? 'bg-emerald-100 text-emerald-800' : 'bg-primary-container/15 text-primary'}">
                    ${user.role === 'admin' ? 'Quản trị viên' : restaurantRole ? 'Chủ quán' : 'Khách hàng'}
                  </span>
                </div>
              </div>

              <div class="py-1">
                <a href="/profile.html" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors">
                  <span class="material-symbols-outlined text-[18px] text-secondary">person</span>
                  <span>Hồ sơ cá nhân</span>
                </a>
                <a href="/favorites.html" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors">
                  <span class="material-symbols-outlined text-[18px] text-secondary">favorite</span>
                  <span>Quán đã lưu</span>
                </a>
                <a href="/cart.html" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors">
                  <span class="material-symbols-outlined text-[18px] text-secondary">shopping_bag</span>
                  <span>Giỏ hàng</span>
                </a>
                <a href="/cart.html#orders" class="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low transition-colors">
                  <span class="material-symbols-outlined text-[18px] text-secondary">receipt_long</span>
                  <span>Đơn hàng của tôi</span>
                </a>
                ${restaurantRole ? `
                  <a href="/restaurant.html" class="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">storefront</span>
                    <span>Quản lý quán</span>
                  </a>
                ` : ''}
                ${adminRole ? `
                  <a href="/admin.html" class="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                    <span>Bảng quản trị</span>
                  </a>
                ` : ''}
              </div>

              <div class="border-t border-surface-container-high pt-1">
                <button id="logout-btn" type="button" class="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer">
                  <span class="material-symbols-outlined text-[18px]">logout</span>
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        ` : `
          <!-- Guest Auth Actions -->
          <div class="flex items-center gap-2">
            <a href="/login.html" class="h-9 px-4 inline-flex items-center justify-center font-semibold text-xs text-on-surface hover:text-primary transition-colors">
              Đăng nhập
            </a>
            <a href="/register.html" class="h-9 px-4 inline-flex items-center justify-center font-semibold text-xs bg-primary-container text-on-primary hover:bg-primary rounded-full transition-all shadow-sm">
              Đăng ký
            </a>
          </div>
        `}

        <!-- Mobile Menu Toggle Button -->
        <button id="mobile-menu-toggle" class="md:hidden p-2 rounded-xl text-on-surface hover:bg-surface-container-low transition-colors">
          <span class="material-symbols-outlined text-[24px]">menu</span>
        </button>
      </div>
    </div>

    <!-- Mobile Drawer -->
    <div id="mobile-drawer" class="hidden md:hidden border-t border-surface-container-high bg-surface-container-lowest px-4 py-3 flex flex-col gap-2">
      <form action="/explore.html" method="GET" class="relative w-full mb-2">
        <span class="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
        <input name="q" class="w-full h-9 pl-9 pr-3 bg-surface-container-low rounded-lg text-xs text-on-surface placeholder:text-secondary focus:outline-none" placeholder="Tìm quán..." type="search" />
      </form>
      <a class="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low ${activeNav === 'home' ? 'text-primary bg-primary/10' : 'text-on-surface'}" href="/index.html">Trang chủ</a>
      <a class="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low ${activeNav === 'explore' ? 'text-primary bg-primary/10' : 'text-on-surface'}" href="/explore.html">Khám phá</a>
      <a class="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low ${activeNav === 'favorites' ? 'text-primary bg-primary/10' : 'text-on-surface'} flex items-center justify-between" href="/favorites.html">
        <span>Yêu thích</span>
        <span class="px-2 py-0.5 text-xs bg-primary-container text-on-primary rounded-full">0</span>
      </a>
      <a class="px-3 py-2 rounded-lg text-sm font-semibold hover:bg-surface-container-low ${activeNav === 'cart' ? 'text-primary bg-primary/10' : 'text-on-surface'} flex items-center justify-between" href="/cart.html">
        <span class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">shopping_bag</span>Giỏ hàng</span>
        <span id="mobile-cart-count" class="header-cart-badge px-2 py-0.5 text-xs bg-primary text-white rounded-full">0</span>
      </a>
      ${restaurantRole ? `<a class="px-3 py-2 rounded-lg text-sm font-bold text-emerald-700 hover:bg-emerald-50" href="/restaurant.html">Quản lý quán</a>` : ''}
      ${adminRole ? `<a class="px-3 py-2 rounded-lg text-sm font-bold text-amber-600 hover:bg-amber-50" href="/admin.html">Quản trị Website</a>` : ''}
    </div>
  `;

  // Gắn sự kiện dropdown
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      if (!userDropdown.classList.contains('hidden')) {
        userDropdown.classList.add('hidden');
      }
    });
  }

  // Sự kiện đăng xuất
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Sự kiện toggle mobile menu
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('hidden');
    });
  }

  // Tự động load số lượng favorites và cart vào badge
  updateFavoritesBadge();
  updateCartBadge();
  loadCartFromServer();
}

// Khởi tạo Footer chuẩn
export function initFooter() {
  const footerContainer = document.querySelector('footer');
  if (!footerContainer) return;

  footerContainer.className = 'w-full bg-surface-container-lowest border-t border-surface-container-high py-12 mt-16';
  footerContainer.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        <div class="md:col-span-2">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-primary-container text-white flex items-center justify-center font-bold text-sm">F</div>
            <span class="text-xl font-black text-primary">Food<span class="text-on-surface">Hub</span></span>
          </div>
          <p class="text-sm text-secondary max-w-sm leading-relaxed mb-4">
            Nền tảng tìm kiếm, khám phá và chia sẻ trải nghiệm ăn uống chân thực nhất cùng cộng đồng yêu ẩm thực Việt Nam.
          </p>
          <div class="flex items-center gap-3 text-secondary text-sm">
            <span class="material-symbols-outlined text-[18px]">call</span>
            <span>Hotline: 1900 8888 (8:00 - 22:00)</span>
          </div>
        </div>

        <div>
          <h4 class="text-sm font-bold text-on-surface uppercase tracking-wider mb-3">Điều hướng</h4>
          <ul class="space-y-2 text-sm text-secondary">
            <li><a href="/index.html" class="hover:text-primary transition-colors">Trang chủ</a></li>
            <li><a href="/explore.html" class="hover:text-primary transition-colors">Khám phá quán ăn</a></li>
            <li><a href="/favorites.html" class="hover:text-primary transition-colors">Danh sách yêu thích</a></li>
            <li><a href="/login.html" class="hover:text-primary transition-colors">Tài khoản cá nhân</a></li>
          </ul>
        </div>

        <div>
          <h4 class="text-sm font-bold text-on-surface uppercase tracking-wider mb-3">Thông tin</h4>
          <ul class="space-y-2 text-sm text-secondary">
            <li><a href="/explore.html?area=Hoàn Kiếm" class="hover:text-primary transition-colors">Khu vực Hoàn Kiếm</a></li>
            <li><a href="/explore.html?area=Hai Bà Trưng" class="hover:text-primary transition-colors">Khu vực Hai Bà Trưng</a></li>
            <li><a href="/explore.html?category=Món Việt" class="hover:text-primary transition-colors">Ẩm thực Món Việt</a></li>
            <li><a href="/admin.html" class="hover:text-amber-600 transition-colors">Quản trị viên</a></li>
          </ul>
        </div>
      </div>

      <div class="pt-6 border-t border-surface-container-high flex flex-col sm:flex-row items-center justify-between text-xs text-secondary gap-3">
        <p>© 2026 FoodHub Platform. Bản quyền thuộc về FoodHub.</p>
        <div class="flex items-center gap-4">
          <span>Hệ thống bảo mật</span>
          <span>•</span>
          <span>Bảo vệ quyền riêng tư</span>
        </div>
      </div>
    </div>
  `;
}

// Bảo vệ route yêu cầu đăng nhập
export function requireAuth() {
  if (!isLoggedIn()) {
    toast.warning('Vui lòng đăng nhập để truy cập trang này.');
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login.html?returnUrl=${returnUrl}`;
    return false;
  }
  return true;
}

// Bảo vệ route yêu cầu quyền admin
export function requireAdmin() {
  if (!isLoggedIn()) {
    toast.warning('Vui lòng đăng nhập quyền Quản trị viên.');
    window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }
  if (!isAdmin()) {
    toast.error('Bạn không có quyền truy cập trang quản trị.');
    window.location.href = '/index.html';
    return false;
  }
  return true;
}
