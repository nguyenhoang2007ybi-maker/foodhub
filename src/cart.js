import { api } from './api.js';
import { getUser, isLoggedIn } from './auth.js';

let syncTimeout = null;

const MAX_QUANTITY = 99;

// Dữ liệu menu cũ có thể thiếu id. Hàm này tạo id ổn định từ tên món
// để các thao tác +/- và Xóa vẫn xác định đúng món trong giỏ.
function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function parsePositiveId(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function resolveDishId(dish, fallbackIndex = 0) {
  const numericId = parsePositiveId(dish ? (dish.dishId ?? dish.id) : null);
  if (numericId) return numericId;
  const name = dish ? (dish.name || dish.dishName || '') : '';
  return hashString(name || `dish-${fallbackIndex}`) || fallbackIndex + 1;
}

function resolvePriceNum(item) {
  const current = Number(item && item.priceNum);
  if (Number.isFinite(current) && current > 0) return current;
  return parseInt(String((item && item.price) || '').replace(/[^\d]/g, ''), 10) || 0;
}

function resolveQuantity(value) {
  const quantity = parseInt(value, 10);
  return Math.min(MAX_QUANTITY, Math.max(1, Number.isFinite(quantity) ? quantity : 1));
}

// Chuẩn hóa menu theo cùng quy tắc với server để id món luôn ổn định,
// kể cả khi dữ liệu cũ chưa có id/priceNum.
export function normalizeMenuItems(restaurant) {
  const menu = Array.isArray(restaurant?.menu) ? restaurant.menu : [];
  const restId = parsePositiveId(restaurant?.id);
  const usedIds = new Set();

  return menu.map((dish, index) => {
    let id = parsePositiveId(dish?.id);
    if (!id) {
      id = restId ? restId * 1000 + index + 1 : hashString(dish?.name || `dish-${index}`) || index + 1;
      while (usedIds.has(id)) id += 1;
    }
    usedIds.add(id);
    return {
      ...dish,
      id,
      priceNum: resolvePriceNum(dish)
    };
  });
}

// Chỉ trả về món khi nó thực sự thuộc menu của quán.
// Nếu món có id hợp lệ thì bắt buộc id phải khớp; chỉ dùng tên chính xác
// để nâng cấp dữ liệu menu cũ vốn chưa có id.
export function resolveMenuItem(restaurant, dish) {
  if (!parsePositiveId(restaurant?.id)) return null;
  const menu = normalizeMenuItems(restaurant);
  const dishId = parsePositiveId(dish?.dishId ?? dish?.id);

  if (dishId) {
    return menu.find(item => Number(item.id) === dishId) || null;
  }

  const name = String(dish?.name || dish?.dishName || '').trim();
  return name ? menu.find(item => item.name === name) || null : null;
}

// Đối chiếu giỏ hàng cũ với menu hiện tại. Món không còn hợp lệ được giữ lại
// và trả về danh sách lỗi để UI cho người dùng xóa, không tự thay món khác.
export function validateCartAgainstRestaurant(restaurant, cart = getCart()) {
  const restId = parsePositiveId(restaurant?.id);
  const menu = normalizeMenuItems(restaurant);
  const invalidItems = [];
  let changed = false;

  if (!restId) {
    cart.items.forEach(item => {
      invalidItems.push({
        dishId: item.dishId,
        name: item.name,
        reason: `Không xác định được quán ăn của món "${item.name}".`
      });
    });
    return { cart, invalidItems, changed };
  }

  const itemsById = new Map();
  const validItems = [];

  cart.items.forEach(item => {
    const itemRestaurantId = parsePositiveId(item.restaurantId);
    if (itemRestaurantId && itemRestaurantId !== restId) {
      invalidItems.push({
        dishId: item.dishId,
        name: item.name,
        reason: `Món "${item.name}" thuộc quán khác, không thể đặt tại ${restaurant.name}.`
      });
      validItems.push(item);
      return;
    }

    let menuItem = menu.find(entry => Number(entry.id) === Number(item.dishId));

    if (!menuItem && item.name) {
      menuItem = menu.find(entry => entry.name === item.name);
    }

    if (!menuItem) {
      invalidItems.push({
        dishId: item.dishId,
        name: item.name,
        reason: `Món "${item.name}" không còn trong thực đơn của quán.`
      });
      validItems.push(item);
      return;
    }

    if (menuItem.isAvailable === false) {
      invalidItems.push({
        dishId: item.dishId,
        name: menuItem.name,
        reason: `Món "${menuItem.name}" hiện đã hết hàng.`
      });
      validItems.push(item);
      return;
    }

    const priceNum = resolvePriceNum(menuItem);
    if (priceNum <= 0) {
      invalidItems.push({
        dishId: item.dishId,
        name: menuItem.name,
        reason: `Món "${menuItem.name}" chưa có giá hợp lệ.`
      });
      validItems.push(item);
      return;
    }

    const menuId = Number(menuItem.id);
    const existing = itemsById.get(menuId);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, resolveQuantity(existing.quantity) + resolveQuantity(item.quantity));
      if (!existing.note && item.note) existing.note = item.note;
      changed = true;
      return;
    }

    if (Number(item.dishId) !== menuId) {
      item.dishId = menuId;
      changed = true;
    }
    if (Number(item.restaurantId) !== restId) {
      item.restaurantId = restId;
      changed = true;
    }
    if (item.name !== menuItem.name) {
      item.name = menuItem.name;
      changed = true;
    }
    if (item.price !== menuItem.price) {
      item.price = menuItem.price;
      changed = true;
    }
    if (Number(item.priceNum) !== priceNum) {
      item.priceNum = priceNum;
      changed = true;
    }
    if (item.image !== (menuItem.image || '')) {
      item.image = menuItem.image || '';
      changed = true;
    }

    itemsById.set(menuId, item);
    validItems.push(item);
  });

  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    changed = true;
  }

  if (cart.restaurantName !== restaurant.name) {
    cart.restaurantName = restaurant.name || '';
    changed = true;
  }
  if (cart.restaurantAddress !== (restaurant.address || '')) {
    cart.restaurantAddress = restaurant.address || '';
    changed = true;
  }

  return { cart, invalidItems, changed };
}

// Khóa lưu giỏ hàng theo từng user hoặc khách vãng lai
export function getCartKey() {
  const user = getUser();
  return user ? `foodhub_cart_user_${user.id}` : 'foodhub_cart_guest';
}

// Lấy dữ liệu giỏ hàng hiện tại
export function getCart() {
  try {
    const key = getCartKey();
    const raw = localStorage.getItem(key);
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

    // Chuẩn hóa dữ liệu cũ: bổ sung dishId/priceNum/số lượng hợp lệ để
    // các nút thao tác không bị lệch id hoặc tính sai thành tiền.
    const usedIds = new Set();
    cart.items = cart.items
      .filter(item => item && typeof item === 'object')
      .map((rawItem, index) => {
        const item = { ...rawItem };
        let dishId = resolveDishId(item, index);
        while (usedIds.has(dishId)) dishId += 1;
        usedIds.add(dishId);

        item.dishId = dishId;
        item.quantity = resolveQuantity(item.quantity);
        item.priceNum = resolvePriceNum(item);
        item.note = item.note || '';
        if (!item.restaurantId && cart.restaurantId) {
          item.restaurantId = cart.restaurantId;
        }
        return item;
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
  const restId = parsePositiveId(restaurant?.id);

  if (!restId) {
    return {
      success: false,
      invalid: true,
      message: 'Không xác định được quán ăn để thêm món.'
    };
  }

  const menuItem = resolveMenuItem(restaurant, dish);
  if (!menuItem) {
    return {
      success: false,
      invalid: true,
      message: `Món "${dish?.name || 'đã chọn'}" không thuộc thực đơn của quán ${restaurant?.name || ''}.`.trim()
    };
  }

  if (menuItem.isAvailable === false) {
    return {
      success: false,
      invalid: true,
      message: `Món "${menuItem.name}" hiện đã hết hàng.`
    };
  }

  const priceNum = resolvePriceNum(menuItem);
  if (priceNum <= 0) {
    return {
      success: false,
      invalid: true,
      message: `Món "${menuItem.name}" chưa có giá hợp lệ để đặt hàng.`
    };
  }

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

  const dishId = Number(menuItem.id);
  const requestedQuantity = Number(quantity);
  const addQuantity = Number.isInteger(requestedQuantity) && requestedQuantity > 0
    ? Math.min(MAX_QUANTITY, requestedQuantity)
    : 1;

  // Khớp theo id hoặc theo tên để nâng cấp được các món cũ bị thiếu dishId.
  const existingItem = cart.items.find(item =>
    Number(item.dishId) === dishId || (item.name && item.name === menuItem.name)
  );

  if (existingItem) {
    existingItem.dishId = dishId;
    existingItem.restaurantId = restId;
    existingItem.name = menuItem.name;
    existingItem.price = menuItem.price;
    existingItem.priceNum = priceNum;
    existingItem.image = menuItem.image || '';
    existingItem.quantity = Math.min(MAX_QUANTITY, resolveQuantity(existingItem.quantity) + addQuantity);
    if (note) existingItem.note = note;
  } else {
    cart.items.push({
      dishId,
      restaurantId: restId,
      name: menuItem.name,
      price: menuItem.price,
      priceNum,
      image: menuItem.image || '',
      quantity: addQuantity,
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
  const restId = parsePositiveId(restaurant?.id);
  const menuItem = resolveMenuItem(restaurant, dish);

  if (!restId || !menuItem) {
    return {
      success: false,
      invalid: true,
      message: `Món "${dish?.name || 'đã chọn'}" không thuộc thực đơn của quán ${restaurant?.name || ''}.`.trim()
    };
  }

  if (menuItem.isAvailable === false) {
    return {
      success: false,
      invalid: true,
      message: `Món "${menuItem.name}" hiện đã hết hàng.`
    };
  }

  const priceNum = resolvePriceNum(menuItem);
  if (priceNum <= 0) {
    return {
      success: false,
      invalid: true,
      message: `Món "${menuItem.name}" chưa có giá hợp lệ để đặt hàng.`
    };
  }

  const newCart = {
    restaurantId: restId,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address || '',
    items: [
      {
        dishId: Number(menuItem.id),
        restaurantId: restId,
        name: menuItem.name,
        price: menuItem.price,
        priceNum,
        image: menuItem.image || '',
        quantity: resolveQuantity(quantity),
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
  const idNum = Number(dishId);
  const itemIndex = cart.items.findIndex(i => Number(i.dishId) === idNum);

  if (itemIndex === -1) return cart;

  const currentQuantity = resolveQuantity(cart.items[itemIndex].quantity);
  const nextQuantity = Math.min(MAX_QUANTITY, Math.max(1, currentQuantity + (Number(delta) || 0)));

  // Số lượng tối thiểu là 1. Muốn bỏ món thì dùng nút Xóa.
  if (nextQuantity === currentQuantity) return cart;

  cart.items[itemIndex].quantity = nextQuantity;

  saveCart(cart);
  return cart;
}

// Xóa 1 món khỏi giỏ
export function removeItem(dishId) {
  const cart = getCart();
  const idNum = Number(dishId);
  cart.items = cart.items.filter(i => Number(i.dishId) !== idNum);

  if (cart.items.length === 0) {
    cart.restaurantId = null;
    cart.restaurantName = '';
    cart.restaurantAddress = '';
  }

  saveCart(cart);
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
  if (!isLoggedIn()) {
    window.dispatchEvent(new CustomEvent('foodhub:cart-synced'));
    return;
  }
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
  } finally {
    window.dispatchEvent(new CustomEvent('foodhub:cart-synced'));
  }
}
