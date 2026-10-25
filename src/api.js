// FoodHub Centralized API Client
import { toast } from './toast.js';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = sessionStorage.getItem('foodhub_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
    });
  } catch (networkErr) {
    console.error('Lỗi kết nối mạng:', networkErr);
    toast.error('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc backend server.');
    throw new ApiError('Lỗi kết nối máy chủ', 0, null);
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg = (data && data.message) || `Yêu cầu thất bại (Mã: ${response.status})`;
    
    // Nếu token hết hạn hoặc không hợp lệ khi đang có token
    if (response.status === 401 && token) {
      sessionStorage.removeItem('foodhub_token');
      sessionStorage.removeItem('foodhub_user');
      try { localStorage.removeItem('foodhub_token'); } catch (_) {}
      try { localStorage.removeItem('foodhub_user'); } catch (_) {}
      toast.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      setTimeout(() => {
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = `/login.html?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }
      }, 1200);
    }

    throw new ApiError(errorMsg, response.status, data);
  }

  return data;
}

export const api = {
  get: (url, options) => request(url, { method: 'GET', ...options }),
  post: (url, body, options) => request(url, { method: 'POST', body, ...options }),
  put: (url, body, options) => request(url, { method: 'PUT', body, ...options }),
  patch: (url, body, options) => request(url, { method: 'PATCH', body, ...options }),
  delete: (url, options) => request(url, { method: 'DELETE', ...options })
};

export default api;
