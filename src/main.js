import './style.css'

const products = [
  {
    id: 1,
    name: 'Tai nghe Bluetooth Pro',
    category: 'Điện tử',
    price: 890000,
    oldPrice: 1250000,
    emoji: '🎧',
    gradient: 'linear-gradient(135deg,#ff9a9e,#fad0c4)',
    badge: 'Giảm 29%',
  },
  {
    id: 2,
    name: 'Đồng hồ thông minh S9',
    category: 'Điện tử',
    price: 2490000,
    oldPrice: 3290000,
    emoji: '⌚',
    gradient: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
    badge: 'Hot',
  },
  {
    id: 3,
    name: 'Áo thun cotton cao cấp',
    category: 'Thời trang',
    price: 250000,
    oldPrice: 320000,
    emoji: '👕',
    gradient: 'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
    badge: 'Mới',
  },
  {
    id: 4,
    name: 'Giày thể thao Air Run',
    category: 'Thời trang',
    price: 1290000,
    oldPrice: 1590000,
    emoji: '👟',
    gradient: 'linear-gradient(135deg,#fddb92,#d1fdff)',
    badge: 'Giảm 19%',
  },
  {
    id: 5,
    name: 'Bàn phím cơ RGB 87 phím',
    category: 'Phụ kiện',
    price: 1190000,
    oldPrice: 1500000,
    emoji: '⌨️',
    gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)',
    badge: 'Bán chạy',
  },
  {
    id: 6,
    name: 'Chuột không dây Silent',
    category: 'Phụ kiện',
    price: 450000,
    oldPrice: 550000,
    emoji: '🖱️',
    gradient: 'linear-gradient(135deg,#84fab0,#8fd3f4)',
  },
  {
    id: 7,
    name: 'Balo laptop chống nước',
    category: 'Phụ kiện',
    price: 690000,
    oldPrice: 890000,
    emoji: '🎒',
    gradient: 'linear-gradient(135deg,#f6d365,#fda085)',
    badge: 'Giảm 22%',
  },
  {
    id: 8,
    name: 'Máy lọc không khí Mini',
    category: 'Gia dụng',
    price: 1890000,
    oldPrice: 2390000,
    emoji: '🌀',
    gradient: 'linear-gradient(135deg,#c2b9e7,#9fd8df)',
  },
]

const categories = [
  { name: 'Điện tử', emoji: '📱', color: '#a1c4fd' },
  { name: 'Thời trang', emoji: '👗', color: '#fbc2eb' },
  { name: 'Phụ kiện', emoji: '🎧', color: '#a18cd1' },
  { name: 'Gia dụng', emoji: '🏠', color: '#f6d365' },
]

const formatPrice = (n) => n.toLocaleString('vi-VN') + ' ₫'

const getCart = () => {
  try {
    return JSON.parse(localStorage.getItem('vietshop-cart')) || []
  } catch {
    return []
  }
}

const addToCart = (id) => {
  const cart = getCart()
  const found = cart.find((i) => i.id === id)
  if (found) found.qty += 1
  else cart.push({ id, qty: 1 })
  localStorage.setItem('vietshop-cart', JSON.stringify(cart))
  updateCartCount()
  showToast(`Đã thêm "${products.find((p) => p.id === id).name}" vào giỏ`)
}

const showToast = (message) => {
  const toast = document.querySelector('#toast')
  toast.textContent = message
  toast.classList.add('show')
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200)
}

const updateCartCount = () => {
  const count = getCart().reduce((s, i) => s + i.qty, 0)
  const badge = document.querySelector('#cart-count')
  if (badge) {
    badge.textContent = count
    badge.style.display = count > 0 ? '' : 'none'
  }
}

const productCard = (p) => `
  <article class="product-card">
    <div class="product-media" style="background:${p.gradient}">
      ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
      <span class="product-emoji">${p.emoji}</span>
      <span class="product-cat">${p.category}</span>
    </div>
    <div class="product-body">
      <h3>${p.name}</h3>
      <div class="product-price">
        <strong>${formatPrice(p.price)}</strong>
        ${p.oldPrice ? `<del>${formatPrice(p.oldPrice)}</del>` : ''}
      </div>
      <button class="btn btn-accent" data-id="${p.id}" type="button">Thêm vào giỏ</button>
    </div>
  </article>
`

document.querySelector('#app').innerHTML = `
  <a href="#hero" class="skip-link" aria-label="Bỏ qua điều hướng">Bỏ qua điều hướng</a>

  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo">
        <span class="logo-mark">🇻🇳</span>
        <span>VietShop</span>
      </a>
      <nav class="nav" aria-label="Điều hướng chính">
        <a href="#hero">Trang chủ</a>
        <a href="#categories">Danh mục</a>
        <a href="#products">Sản phẩm</a>
        <a href="#promo">Khuyến mãi</a>
      </nav>
      <a href="/cart.html" class="cart-link" aria-label="Giỏ hàng">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zM8.1 13h9.9c.75 0 1.41-.41 1.75-1.03L23 5.6a1 1 0 0 0-.9-1.6H5.21l-.94-2H0v2h4l3.6 7.59-1.35 2.44C5.52 13.37 6 14 6 14h11v-2H8.6l-.5-1zM19 2c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" transform="scale(0.6) translate(8 8)"/>
        </svg>
        <span class="cart-count" id="cart-count" hidden>0</span>
      </a>
    </div>
  </header>

  <main>
    <section id="hero" class="hero">
      <div class="container hero-inner">
        <div class="hero-text">
          <p class="hero-kicker">🏷️ Ưu đãi đến 50% cuối năm</p>
          <h1>Mua sắm dễ dàng,<br>nhận ngay ưu đãi <em>siêu hấp dẫn</em></h1>
          <p class="hero-sub">
            Hàng ngàn sản phẩm chính hãng, giao hàng nhanh toàn quốc,
            đổi trả trong 30 ngày. Trải nghiệm mua sắm tuyệt vời nhất tại VietShop.
          </p>
          <div class="hero-actions">
            <a href="#products" class="btn btn-primary">Mua ngay</a>
            <a href="#promo" class="btn btn-ghost">Xem khuyến mãi</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <span class="bubble b1">🎉</span>
          <span class="bubble b2">📦</span>
          <span class="bubble b3">⚡</span>
          <span class="bubble b4">💳</span>
          <span class="hero-box bx1"></span>
          <span class="hero-box bx2"></span>
        </div>
      </div>
    </section>

    <section id="features" class="features">
      <div class="container features-grid">
        <div class="feature"><span>🚚</span><div><strong>Giao hàng nhanh</strong><p>Miễn phí đơn từ 500k</p></div></div>
        <div class="feature"><span>🛡️</span><div><strong>Bảo hành chính hãng</strong><p>Hỗ trợ suốt đời</p></div></div>
        <div class="feature"><span>↩️</span><div><strong>Đổi trả dễ dàng</strong><p>Trong vòng 30 ngày</p></div></div>
        <div class="feature"><span>🔒</span><div><strong>Thanh toán an toàn</strong><p>Mã hóa bảo mật tuyệt đối</p></div></div>
      </div>
    </section>

    <section id="categories" class="section">
      <div class="container">
        <div class="section-head">
          <h2>Danh mục sản phẩm</h2>
          <p>Khám phá kho hàng đa dạng của chúng tôi</p>
        </div>
        <div class="categories-grid">
          ${categories
            .map(
              (c) => `
            <a href="#products" class="category-card" style="--cat:${c.color}">
              <span class="category-emoji">${c.emoji}</span>
              <strong>${c.name}</strong>
              <small>Khám phá ngay →</small>
            </a>`
            )
            .join('')}
        </div>
      </div>
    </section>

    <section id="products" class="section section-alt">
      <div class="container">
        <div class="section-head">
          <h2>Sản phẩm nổi bật</h2>
          <p>Những sản phẩm được yêu thích nhất tháng này</p>
        </div>
        <div class="products-grid">
          ${products.map(productCard).join('')}
        </div>
      </div>
    </section>

    <section id="promo" class="promo">
      <div class="container promo-inner">
        <div class="promo-text">
          <p class="hero-kicker">⚡ Số lượng có hạn</p>
          <h2>Siêu sale cuối năm — giảm đến 50%</h2>
          <p class="promo-sub">Nhập mã <code>VIETSHOP50</code> khi thanh toán để nhận thêm ưu đãi. Kết thúc vào 23:59 hôm nay!</p>
          <a href="#products" class="btn btn-primary btn-lg">Tham gia ngay</a>
        </div>
        <div class="promo-art" aria-hidden="true">50%<br><small>OFF</small></div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer-grid">
      <div>
        <a href="/" class="logo"><span class="logo-mark">🇻🇳</span>VietShop</a>
        <p class="footer-about">Cửa hàng trực tuyến giúp bạn mua sắm mọi thứ chỉ với vài cú chạm.</p>
        <div class="socials">
          <a href="#" aria-label="Facebook">ⓕ</a>
          <a href="#" aria-label="Instagram">📷</a>
          <a href="#" aria-label="YouTube">▶️</a>
        </div>
      </div>
      <div>
        <h4>Liên kết</h4>
        <a href="#hero">Trang chủ</a>
        <a href="#products">Sản phẩm</a>
        <a href="#categories">Danh mục</a>
        <a href="/cart.html">Giỏ hàng</a>
      </div>
      <div>
        <h4>Hỗ trợ khách hàng</h4>
        <a href="#">Trung tâm trợ giúp</a>
        <a href="#">Chính sách đổi trả</a>
        <a href="#">Chính sách vận chuyển</a>
        <a href="#">Câu hỏi thường gặp</a>
      </div>
      <div>
        <h4>Liên hệ</h4>
        <p>📍 123 Nguyễn Trãi, Hà Nội</p>
        <p>📞 1900 1234</p>
        <p>✉️ lienhe@vietshop.vn</p>
      </div>
    </div>
    <div class="container footer-bottom">
      © 2026 VietShop. Tất cả quyền được bảo lưu.
    </div>
  </footer>

  <div id="toast" role="status" aria-live="polite"></div>
`

document.querySelector('.products-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]')
  if (btn) addToCart(Number(btn.dataset.id))
})

updateCartCount()