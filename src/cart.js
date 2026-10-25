import { api } from './api.js';
import { getUser, isLoggedIn } from './auth.js';

let syncTimeout = null;

// Khóa lưu giỏ hàng theo từng user hoặc khách vãng lai
export function getCartKey() {
  const user = getUser();
  return user ? `foodhub_cart_user_${user.id}` : 'foodhub_cart_guest';
}

// Lấy dữ liệu giỏ hàng hiện tại (kèm cơ chế tự động sửa lỗi & làm sạch dữ liệu giỏ cũ)
export function getCart() {
  try {
    const key = getCartKey();
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (!raw) {
      return {
        restaurantId: null,
        restaurantName: '',
        restaurantAddress: '',
        items: []
      };
    }
    const cart = JSON.parse(raw);
    if (!Array.isArray(cart.items)) cart.items = [];

    // Chuẩn hóa cấu trúc giỏ hàng
    cart.restaurantId = cart.restaurantId ? Number(cart.restaurantId) : null;
    cart.items = cart.items.map(item => {
      const rawId = item.dishId !== undefined ? item.dishId : (item.id !== undefined ? item.id : (item.foodId || item.menuItemId));
      const numId = (rawId !== null && rawId !== undefined && !isNaN(Number(rawId))) ? Number(rawId) : null;
      const priceNum = (typeof item.priceNum === 'number' && item.priceNum > 0)
        ? item.priceNum
        : (parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10) || 0);

      return {
        ...item,
        dishId: numId,
        id: numId,
        name: item.name || '',
        price: item.price || (priceNum ? `${priceNum.toLocaleString('vi-VN')} đ` : '0 đ'),
        priceNum,
        image: item.image || '',
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        note: item.note ? String(item.note).trim() : ''
      };
    });

    return cart;
  } catch (e) {
    console.error('Lỗi đọc giỏ hàng từ localStorage:', e);
    return {
      restaurantId: null,
      restaurantName: '',
      restaurantAddress: '',
      items: []
    };
  }
}

// Lưu dữ liệu giỏ hàng
export function saveCart(cart, syncServer = true) {
  try {
    const key = getCartKey();
    sessionStorage.setItem(key, JSON.stringify(cart));
    localStorage.setItem(key, JSON.stringify(cart));
    updateCartBadge();

    // Phát sự kiện để các view lắng nghe cập nhật realtime
    window.dispatchEvent(new CustomEvent('foodhub:cart-updated', { detail: cart }));

    // Tự động đồng bộ lên backend nếu đã đăng nhập
    if (syncServer && isLoggedIn()) {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        api.post('/cart', {
          items: cart.items,
          restaurantId: cart.restaurantId,
          restaurantName: cart.restaurantName,
          restaurantAddress: cart.restaurantAddress
        }).catch(err => console.warn('Không thể đồng bộ giỏ hàng lên server:', err));
      }, 500);
    }
  } catch (e) {
    console.error('Lỗi lưu giỏ hàng:', e);
  }
}

// Thêm món vào giỏ hàng
// Kiểm tra xung đột nếu giỏ hàng đang có món của quán khác
export function addToCart(dish, restaurant, quantity = 1, note = '') {
  const cart = getCart();
  const restId = Number(restaurant.id);

  // Nếu trong giỏ đã có món và thuộc quán khác -> Báo xung đột
  if (cart.items.length > 0 && cart.restaurantId && Number(cart.restaurantId) !== restId) {
    return {
      success: false,
      conflict: true,
      currentRestaurant: {
        id: cart.restaurantId,
        name: cart.restaurantName
      },
      newRestaurant: {
        id: restaurant.id,
        name: restaurant.name
      }
    };
  }

  // Cập nhật thông tin quán cho giỏ
  cart.restaurantId = restId;
  cart.restaurantName = restaurant.name;
  cart.restaurantAddress = restaurant.address || '';

  // Phân giải ID món ăn chắc chắn (không bao giờ để NaN)
  const rawId = dish.id !== undefined ? dish.id : (dish.dishId !== undefined ? dish.dishId : (dish.foodId || dish.menuItemId));
  let resolvedId = (rawId !== null && rawId !== undefined && !isNaN(Number(rawId))) ? Number(rawId) : null;

  // Nếu món không có ID nhưng có restaurant.menu, tìm theo tên trong thực đơn
  if (resolvedId === null && restaurant && Array.isArray(restaurant.menu)) {
    const match = restaurant.menu.find(m => m.name && dish.name && m.name.trim().toLowerCase() === dish.name.trim().toLowerCase());
    if (match && match.id) {
      resolvedId = Number(match.id);
    }
  }

  const priceNum = (typeof dish.priceNum === 'number' && dish.priceNum > 0)
    ? dish.priceNum
    : (parseInt(String(dish.price || '').replace(/[^\d]/g, ''), 10) || 0);

  // Tìm món đã tồn tại trong giỏ (so sánh theo ID hoặc tên)
  const existingItem = cart.items.find(item => {
    if (resolvedId !== null && item.dishId !== null) {
      return Number(item.dishId) === resolvedId || Number(item.id) === resolvedId;
    }
    if (item.name && dish.name && item.name.trim().toLowerCase() === dish.name.trim().toLowerCase()) {
      return true;
    }
    return false;
  });

  if (existingItem) {
    existingItem.quantity += Math.max(1, quantity);
    if (resolvedId !== null) {
      existingItem.dishId = resolvedId;
      existingItem.id = resolvedId;
    }
    if (priceNum > 0) existingItem.priceNum = priceNum;
    if (note) existingItem.note = note;
  } else {
    cart.items.push({
      dishId: resolvedId,
      id: resolvedId,
      name: dish.name || '',
      price: dish.price || (priceNum ? `${priceNum.toLocaleString('vi-VN')} đ` : '0 đ'),
      priceNum: priceNum,
      image: dish.image || '',
      quantity: Math.max(1, quantity),
      note: note || ''
    });
  }

  saveCart(cart);

  return {
    success: true,
    conflict: false,
    cart
  };
}

// Thay thế giỏ hàng bằng món của quán mới (khi người dùng đồng ý đổi quán)
export function replaceCartWithDish(dish, restaurant, quantity = 1, note = '') {
  const restId = Number(restaurant.id);
  const rawId = dish.id !== undefined ? dish.id : (dish.dishId !== undefined ? dish.dishId : (dish.foodId || dish.menuItemId));
  let resolvedId = (rawId !== null && rawId !== undefined && !isNaN(Number(rawId))) ? Number(rawId) : null;

  if (resolvedId === null && restaurant && Array.isArray(restaurant.menu)) {
    const match = restaurant.menu.find(m => m.name && dish.name && m.name.trim().toLowerCase() === dish.name.trim().toLowerCase());
    if (match && match.id) {
      resolvedId = Number(match.id);
    }
  }

  const priceNum = (typeof dish.priceNum === 'number' && dish.priceNum > 0)
    ? dish.priceNum
    : (parseInt(String(dish.price || '').replace(/[^\d]/g, ''), 10) || 0);

  const newCart = {
    restaurantId: restId,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address || '',
    items: [
      {
        dishId: resolvedId,
        id: resolvedId,
        name: dish.name || '',
        price: dish.price || (priceNum ? `${priceNum.toLocaleString('vi-VN')} đ` : '0 đ'),
        priceNum: priceNum,
        image: dish.image || '',
        quantity: Math.max(1, quantity),
        note: note || ''
      }
    ]
  };

  saveCart(newCart);
  return { success: true, cart: newCart };
}

// Cập nhật số lượng món
export function updateQuantity(dishId, delta) {
  const cart = getCart();
  const idNum = (dishId !== null && dishId !== undefined && !isNaN(Number(dishId)) && Number(dishId) > 0) ? Number(dishId) : null;
  const rawTargetName = (typeof dishId === 'string') ? dishId.trim().toLowerCase() : '';

  const itemIndex = cart.items.findIndex(i => {
    if (idNum !== null) {
      return Number(i.dishId) === idNum || Number(i.id) === idNum;
    }
    if (rawTargetName && i.name && i.name.trim().toLowerCase() === rawTargetName) {
      return true;
    }
    return false;
  });

  if (itemIndex === -1) return cart;

  cart.items[itemIndex].quantity += delta;

  if (cart.items[itemIndex].quantity <= 0) {
    cart.items.splice(itemIndex, 1);
  }

  if (cart.items.length === 0) {
    cart.restaurantId = null;
    cart.restaurantName = '';
    cart.restaurantAddress = '';
  }

  saveCart(cart);
  return cart;
}

// Xóa 1 món khỏi giỏ
export function removeItem(dishId) {
  const cart = getCart();
  const idNum = (dishId !== null && dishId !== undefined && !isNaN(Number(dishId)) && Number(dishId) > 0) ? Number(dishId) : null;
  const rawTargetName = (typeof dishId === 'string') ? dishId.trim().toLowerCase() : '';

  cart.items = cart.items.filter(i => {
    if (idNum !== null) {
      return Number(i.dishId) !== idNum && Number(i.id) !== idNum;
    }
    if (rawTargetName && i.name && i.name.trim().toLowerCase() === rawTargetName) {
      return false;
    }
    return true;
  });

  if (cart.items.length === 0) {
    cart.restaurantId = null;
    cart.restaurantName = '';
    cart.restaurantAddress = '';
  }

  saveCart(cart);
  return cart;
}

// Tự động phân giải ID và cập nhật giá từ thực đơn nhà hàng (cho giỏ hàng cũ hoặc món thiếu ID)
export async function healCart(cart) {
  if (!cart) cart = getCart();
  if (!cart.restaurantId || !Array.isArray(cart.items) || cart.items.length === 0) {
    return cart;
  }
  const needsHealing = cart.items.some(i => i.dishId === null || !i.priceNum || i.priceNum <= 0);
  if (!needsHealing) return cart;

  try {
    const res = await api.get(`/restaurants/${cart.restaurantId}`);
    if (res && res.success && res.data && Array.isArray(res.data.menu)) {
      const menu = res.data.menu;
      let changed = false;
      cart.items.forEach(item => {
        if (item.dishId === null || !item.priceNum || item.priceNum <= 0) {
          const match = menu.find(m => m.name && item.name && m.name.trim().toLowerCase() === item.name.trim().toLowerCase());
          if (match && match.id) {
            item.dishId = Number(match.id);
            item.id = Number(match.id);
            item.priceNum = Number(match.priceNum) || (parseInt(String(match.price || '').replace(/[^\d]/g, ''), 10) || item.priceNum);
            item.price = match.price || item.price;
            changed = true;
          }
        }
      });
      if (changed) {
        saveCart(cart, true);
      }
    }
  } catch (err) {
    console.warn('Không thể tự động phân giải giỏ hàng:', err);
  }
  return cart;
}

// Xóa sạch giỏ hàng
export async function clearCart() {
  const emptyCart = {
    restaurantId: null,
    restaurantName: '',
    restaurantAddress: '',
    items: []
  };

  saveCart(emptyCart, false);

  if (isLoggedIn()) {
    try {
      await api.delete('/cart');
    } catch (e) {
      console.warn('Lỗi xóa giỏ hàng server:', e);
    }
  }

  return emptyCart;
}

// Tính tổng số lượng sản phẩm trong giỏ
export function getCartCount() {
  const cart = getCart();
  return cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

// Tính tổng tiền các món trong giỏ (chưa tính ship & giảm giá)
export function getCartSubtotal() {
  const cart = getCart();
  return cart.items.reduce((sum, item) => {
    const p = item.priceNum || (parseInt(String(item.price || '').replace(/[^\d]/g, ''), 10) || 0);
    return sum + p * (Number(item.quantity) || 0);
  }, 0);
}

// Định dạng tiền tệ VND đẹp.
// Nhận cả số và chuỗi giá kiểu Việt Nam ("75.000đ", "10.000đ/cặp").
// Dấu chấm là phân cách hàng nghìn nên phải loại bỏ trước khi parse.
export function formatVND(amount) {
  let n;
  if (typeof amount === 'string') {
    const digits = amount.replace(/[^\d]/g, '');
    n = digits ? parseInt(digits, 10) : 0;
  } else {
    n = Number(amount);
  }
  if (!Number.isFinite(n)) n = 0;
  return n.toLocaleString('vi-VN') + ' đ';
}

// Cập nhật số lượng trên các badge giỏ hàng
export function updateCartBadge() {
  const count = getCartCount();
  const badges = document.querySelectorAll('.header-cart-badge, #header-cart-count, #mobile-cart-count');
  badges.forEach(badge => {
    badge.textContent = count;
    if (count > 0) {
      badge.classList.remove('hidden');
      badge.classList.add('inline-flex');
    } else {
      badge.textContent = '0';
    }
  });
}

// Đồng bộ giỏ hàng từ server khi đăng nhập thành công
export async function loadCartFromServer() {
  if (!isLoggedIn()) return;
  try {
    const res = await api.get('/cart');
    if (res && res.success && res.data) {
      const serverCart = res.data;
      const localCart = getCart();

      // Nếu localCart trống nhưng serverCart có món, lấy từ server
      if (localCart.items.length === 0 && serverCart.items && serverCart.items.length > 0) {
        saveCart({
          restaurantId: serverCart.restaurantId,
          restaurantName: serverCart.restaurantName,
          restaurantAddress: serverCart.restaurantAddress,
          items: serverCart.items
        }, false);
      } else if (localCart.items.length > 0) {
        // Đồng bộ localCart lên server
        saveCart(localCart, true);
      }
    }
  } catch (e) {
    console.warn('Lỗi tải giỏ hàng từ server:', e);
  }
}
