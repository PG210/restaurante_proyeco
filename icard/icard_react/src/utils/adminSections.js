import { PERMISSIONS, hasAnyPermission } from "./permissions";

export const ADMIN_HOME_PATH = "/admin";
export const AVAILABILITY_PATH = "/admin/availability";

export const ADMIN_SECTIONS = {
  orders: {
    path: ADMIN_HOME_PATH,
    label: "Pedidos",
    icon: "home",
    adminOnly: false,
    requiredPermissions: [PERMISSIONS.VIEW_ORDER],
  },
  tableDetail: {
    path: "/admin/table/:id",
    label: "Detalle de mesa",
    icon: "table",
    adminOnly: false,
    requiredPermissions: [PERMISSIONS.VIEW_ORDER],
    inMenu: false,
  },
  kitchen: {
    path: "/admin/kitchen",
    label: "Cocina",
    icon: "food",
    adminOnly: false,
    requiredPermissions: [PERMISSIONS.PREPARE_ORDER],
  },
  paymentsHistory: {
    path: "/admin/payments-history",
    label: "Historial de pagos",
    icon: "history",
    adminOnly: false,
    requiredPermissions: [PERMISSIONS.VIEW_PAYMENTS],
  },
  billTicket: {
    path: "/admin/bills/:id/ticket",
    label: "Ticket",
    icon: "file alternate",
    adminOnly: false,
    requiredPermissions: [PERMISSIONS.CHARGE_BILL, PERMISSIONS.VIEW_PAYMENTS],
    inMenu: false,
  },
  availability: {
    path: AVAILABILITY_PATH,
    label: "Disponibilidad y stock",
    icon: "clipboard check",
    adminOnly: false,
    requiredPermissions: [PERMISSIONS.SET_PRODUCT_AVAILABILITY, PERMISSIONS.MANAGE_STOCK],
  },
  tables: { path: "/admin/tables", label: "Mesas", icon: "table", adminOnly: true },
  tablesQr: { path: "/admin/tables/qr", label: "Imprimir QR", icon: "qrcode", adminOnly: true, inMenu: false },
  categories: { path: "/admin/categories", label: "Categorías", icon: "folder", adminOnly: true },
  products: { path: "/admin/products", label: "Productos", icon: "cart", adminOnly: true },
  users: { path: "/admin/users", label: "Usuarios", icon: "users", adminOnly: true },
  permissions: { path: "/admin/permissions", label: "Permisos", icon: "lock", adminOnly: true },
  settings: { path: "/admin/settings", label: "Configuración", icon: "settings", adminOnly: true },
};

export const ALL_ADMIN_SECTIONS = Object.values(ADMIN_SECTIONS);

export const ADMIN_MENU = ALL_ADMIN_SECTIONS.filter((section) => section.inMenu !== false);

export function canAccessSection(section, user) {
  if (section.adminOnly && !user?.is_staff) return false;
  const required = section.requiredPermissions ?? [];
  return !required.length || hasAnyPermission(user, required);
}

export function getVisibleSections(sections, user) {
  return sections.filter((section) => canAccessSection(section, user));
}

function withId(path, id) {
  return path.replace(":id", id);
}

export function tableDetailPath(tableId) {
  return withId(ADMIN_SECTIONS.tableDetail.path, tableId);
}

export function billTicketPath(billId) {
  return withId(ADMIN_SECTIONS.billTicket.path, billId);
}
