export const PERMISSIONS = {
  VIEW_ORDER: "view_order",
  ADD_ORDER: "add_order",
  PREPARE_ORDER: "prepare_order",
  DELIVER_ORDER: "deliver_order",
  CANCEL_ORDER: "cancel_order",
  OPEN_TABLE: "open_table",
  ATTEND_BILL_REQUEST: "attend_bill_request",
  CHARGE_BILL: "charge_bill",
  VIEW_PAYMENTS: "view_payments",
  SET_PRODUCT_AVAILABILITY: "set_product_availability",
};

export function hasAnyPermission(user, permissions) {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasPermission(user, permission) {
  if (!user) return false;
  return Boolean(user.is_staff) || (user.permissions ?? []).includes(permission);
}
