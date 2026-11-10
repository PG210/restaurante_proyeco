export const PERMISSIONS = {
  VIEW_ORDER: "view_order",
  ADD_ORDER: "add_order",
  PREPARE_ORDER: "prepare_order",
  DELIVER_ORDER: "deliver_order",
  CANCEL_ORDER: "cancel_order",
  OPEN_TABLE: "open_table",
  ATTEND_BILL_REQUEST: "attend_bill_request",
};

export function hasPermission(user, permission) {
  if (!user) return false;
  return Boolean(user.is_staff) || (user.permissions ?? []).includes(permission);
}
