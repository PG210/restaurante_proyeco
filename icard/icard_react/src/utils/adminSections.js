import { PERMISSIONS, hasPermission } from "./permissions";

export const ADMIN_HOME_PATH = "/admin";

export const ADMIN_SECTIONS = {
  orders: {
    path: ADMIN_HOME_PATH,
    label: "Pedidos",
    icon: "home",
    adminOnly: false,
    requiredPermission: PERMISSIONS.VIEW_ORDER,
  },
  tableDetail: {
    path: "/admin/table/:id",
    label: "Detalle de mesa",
    icon: "table",
    adminOnly: false,
    requiredPermission: PERMISSIONS.VIEW_ORDER,
    inMenu: false,
  },
  kitchen: {
    path: "/admin/kitchen",
    label: "Cocina",
    icon: "food",
    adminOnly: false,
    requiredPermission: PERMISSIONS.PREPARE_ORDER,
  },
  tables: { path: "/admin/tables", label: "Mesas", icon: "table", adminOnly: true },
  tablesQr: { path: "/admin/tables/qr", label: "Imprimir QR", icon: "qrcode", adminOnly: true, inMenu: false },
  categories: { path: "/admin/categories", label: "Categorías", icon: "folder", adminOnly: true },
  products: { path: "/admin/products", label: "Productos", icon: "cart", adminOnly: true },
  users: { path: "/admin/users", label: "Usuarios", icon: "users", adminOnly: true },
  permissions: { path: "/admin/permissions", label: "Permisos", icon: "lock", adminOnly: true },
};

export const ALL_ADMIN_SECTIONS = Object.values(ADMIN_SECTIONS);

export const ADMIN_MENU = ALL_ADMIN_SECTIONS.filter((section) => section.inMenu !== false);

export function canAccessSection(section, user) {
  if (section.adminOnly && !user?.is_staff) return false;
  return !section.requiredPermission || hasPermission(user, section.requiredPermission);
}

export function getVisibleSections(sections, user) {
  return sections.filter((section) => canAccessSection(section, user));
}

export function tableDetailPath(tableId) {
  return ADMIN_SECTIONS.tableDetail.path.replace(":id", tableId);
}
