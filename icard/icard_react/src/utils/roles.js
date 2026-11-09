import { EMPTY_VALUE, ROLE_OPTIONS } from "./constants";

export const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((option) => [option.value, option.text]));

export function formatRoles(roles) {
  if (!roles?.length) return EMPTY_VALUE;
  return roles.map((role) => ROLE_LABELS[role] ?? role).join(", ");
}
