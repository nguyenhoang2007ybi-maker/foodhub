export const ORDER_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'preparing',
  'shipping',
  'completed',
  'cancelled'
]);

export const ORDER_STATUS_LABELS = Object.freeze({
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy'
});

export const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze(['confirmed', 'cancelled']),
  confirmed: Object.freeze(['preparing', 'cancelled']),
  preparing: Object.freeze(['shipping']),
  shipping: Object.freeze(['completed']),
  completed: Object.freeze([]),
  cancelled: Object.freeze([])
});

const STATUS_SET = new Set(ORDER_STATUSES);

export function normalizeOrderStatus(status) {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return value === 'delivering' ? 'shipping' : value;
}

export function isOrderStatus(status) {
  return STATUS_SET.has(normalizeOrderStatus(status));
}

export function getOrderStatusLabel(status) {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[normalized] || status || 'Không xác định';
}

export function getAllowedNextStatuses(currentStatus) {
  const normalized = normalizeOrderStatus(currentStatus);
  return [...(ORDER_STATUS_TRANSITIONS[normalized] || [])];
}

export function canTransitionOrderStatus(currentStatus, nextStatus) {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);
  const allowedStatuses = getAllowedNextStatuses(current);

  if (!STATUS_SET.has(current)) {
    return {
      allowed: false,
      code: 'INVALID_CURRENT_STATUS',
      statusCode: 409,
      message: 'Đơn hàng đang có trạng thái không hợp lệ. Vui lòng làm mới dữ liệu.',
      currentStatus: current,
      nextStatus: next,
      allowedStatuses: []
    };
  }

  if (!STATUS_SET.has(next)) {
    return {
      allowed: false,
      code: 'INVALID_NEXT_STATUS',
      statusCode: 400,
      message: `Trạng thái không hợp lệ. Cho phép: ${ORDER_STATUSES.join(', ')}`,
      currentStatus: current,
      nextStatus: next,
      allowedStatuses
    };
  }

  if (current === next) {
    return {
      allowed: false,
      code: 'SAME_STATUS',
      statusCode: 409,
      message: `Đơn hàng đã ở trạng thái "${getOrderStatusLabel(current)}".`,
      currentStatus: current,
      nextStatus: next,
      allowedStatuses
    };
  }

  if (!allowedStatuses.includes(next)) {
    const targetLabel = getOrderStatusLabel(next);
    const message = allowedStatuses.length === 0
      ? `Đơn hàng đã ở trạng thái "${getOrderStatusLabel(current)}" và không thể thay đổi thêm.`
      : `Không thể chuyển từ "${getOrderStatusLabel(current)}" sang "${targetLabel}". ` +
        `Chỉ có thể chuyển sang: ${allowedStatuses.map(getOrderStatusLabel).join(', ')}.`;

    return {
      allowed: false,
      code: 'INVALID_TRANSITION',
      statusCode: 409,
      message,
      currentStatus: current,
      nextStatus: next,
      allowedStatuses
    };
  }

  return {
    allowed: true,
    code: 'OK',
    statusCode: 200,
    message: '',
    currentStatus: current,
    nextStatus: next,
    allowedStatuses
  };
}
