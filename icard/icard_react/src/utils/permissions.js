export const PERMISSIONS = {
  VIEW_ORDER: "view_order",
  ADD_ORDER: "add_order",
  PREPARE_ORDER: "prepare_order",
  DELIVER_ORDER: "deliver_order",
  CANCEL_ORDER: "cancel_order",
};

export function hasPermission(user, permission) {
  if (!user) return false;
  return Boolean(user.is_staff) || (user.permissions ?? []).includes(permission);
}
