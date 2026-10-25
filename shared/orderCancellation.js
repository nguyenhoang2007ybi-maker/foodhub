export const CANCEL_ACTORS = Object.freeze(['customer', 'restaurant', 'admin']);

export const CANCEL_ACTOR_LABELS = Object.freeze({
  customer: 'Khách hàng',
  restaurant: 'Quán ăn',
  admin: 'Quản trị viên'
});

export const CANCELLABLE_ORDER_STATUSES = Object.freeze(['pending', 'confirmed']);

export const CUSTOMER_CANCEL_REASONS = Object.freeze([
  { code: 'wrong_item', label: 'Đặt nhầm món' },
  { code: 'change_order', label: 'Muốn thay đổi đơn hàng' },
  { code: 'personal_plan', label: 'Thay đổi kế hoạch cá nhân' },
  { code: 'delivery_too_slow', label: 'Thời gian giao hàng quá lâu' },
  { code: 'duplicate_order', label: 'Tạo đơn hàng trùng lặp' },
  { code: 'other', label: 'Lý do khác', requiresNote: true }
]);

export const RESTAURANT_CANCEL_REASONS = Object.freeze([
  { code: 'out_of_stock', label: 'Hết nguyên liệu hoặc món ăn' },
  { code: 'temporarily_closed', label: 'Quán tạm ngừng phục vụ' },
  { code: 'preparation_time', label: 'Không thể đáp ứng thời gian chuẩn bị' },
  { code: 'operational_issue', label: 'Không thể phục vụ đơn hàng do sự cố vận hành' },
  { code: 'other', label: 'Lý do khác', requiresNote: true }
]);

export const ADMIN_CANCEL_REASONS = Object.freeze([
  { code: 'customer_request', label: 'Theo yêu cầu của khách hàng' },
  { code: 'restaurant_request', label: 'Theo yêu cầu của quán ăn' },
  { code: 'order_issue', label: 'Đơn hàng có vấn đề cần hủy' },
  { code: 'other', label: 'Lý do khác', requiresNote: true }
]);

const REASON_CATALOG = Object.freeze({
  customer: CUSTOMER_CANCEL_REASONS,
  restaurant: RESTAURANT_CANCEL_REASONS,
  admin: ADMIN_CANCEL_REASONS
});

export function getCancelReasonOptions(actor) {
  return [...(REASON_CATALOG[actor] || [])];
}

export function getCancelActorLabel(actor) {
  return CANCEL_ACTOR_LABELS[actor] || 'Không xác định';
}

export function canActorCancelOrderStatus(status) {
  return CANCELLABLE_ORDER_STATUSES.includes(String(status || '').trim().toLowerCase());
}

export function resolveCancellationInput(actor, rawReason, rawNote) {
  if (!CANCEL_ACTORS.includes(actor)) {
    return {
      ok: false,
      message: 'Không xác định được người thực hiện hủy đơn.'
    };
  }

  const reasonText = String(rawReason ?? '').trim();
  if (!reasonText) {
    return {
      ok: false,
      message: 'Vui lòng chọn lý do hủy đơn.'
    };
  }

  const note = String(rawNote ?? '').trim();
  if (note.length > 500) {
    return {
      ok: false,
      message: 'Ghi chú hủy đơn không được vượt quá 500 ký tự.'
    };
  }

  const options = getCancelReasonOptions(actor);
  const normalizedReason = reasonText.toLowerCase();
  const option = options.find(item =>
    item.code.toLowerCase() === normalizedReason ||
    item.label.toLowerCase() === normalizedReason
  );

  if (!option) {
    return {
      ok: false,
      message: 'Lý do hủy đơn không hợp lệ với vai trò của bạn.'
    };
  }

  if (option.requiresNote && note.length < 3) {
    return {
      ok: false,
      message: 'Vui lòng nhập mô tả cụ thể khi chọn "Lý do khác" (tối thiểu 3 ký tự).'
    };
  }

  return {
    ok: true,
    value: {
      reasonCode: option.code,
      reason: option.label,
      note
    }
  };
}

export function getOrderCancellation(order) {
  if (!order || String(order.status || '').toLowerCase() !== 'cancelled') {
    return null;
  }

  const timeline = Array.isArray(order.timeline) ? order.timeline : [];
  const cancellationEvents = timeline.filter(event => String(event?.status || '').toLowerCase() === 'cancelled');
  const event = cancellationEvents.length > 0 ? cancellationEvents[cancellationEvents.length - 1] : null;

  const actor = order.cancelledBy || event?.cancelledBy || '';
  const reason = order.cancelReason || event?.cancelReason || '';
  const note = order.cancelNote || event?.cancelNote || '';
  const at = order.cancelledAt || event?.cancelledAt || event?.time || order.updatedAt || '';
  const byId = order.cancelledById ?? event?.cancelledById ?? null;
  const byName = order.cancelledByName || event?.cancelledByName || '';

  return {
    actor,
    actorLabel: getCancelActorLabel(actor),
    byId,
    byName,
    reason,
    reasonCode: order.cancelReasonCode || event?.cancelReasonCode || '',
    note,
    at
  };
}
