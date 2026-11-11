import routesAdmin from "../../routes/routes.admin";
import {
  ADMIN_MENU,
  ADMIN_SECTIONS,
  ALL_ADMIN_SECTIONS,
  billTicketPath,
  canAccessSection,
  getMenuSections,
  getVisibleSections,
  isSectionActive,
  tableDetailPath,
} from "../adminSections";
import { PERMISSIONS } from "../permissions";

const STAFF_USER = { is_staff: true, permissions: [] };
const USER_WITHOUT_ROLE = { is_staff: false, permissions: [] };
const WAITER_USER = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.ADD_ORDER] };
const COOK_USER = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.PREPARE_ORDER] };
const ADMIN_ONLY_SECTIONS = ALL_ADMIN_SECTIONS.filter((section) => section.adminOnly);

function visiblePaths(user) {
  return getVisibleSections(ADMIN_MENU, user).map((section) => section.path);
}

describe("admin sections", () => {
  it("shows every menu section to a staff user", () => {
    expect(getVisibleSections(ADMIN_MENU, STAFF_USER)).toEqual(ADMIN_MENU);
  });

  it("shows only orders to a waiter", () => {
    expect(visiblePaths(WAITER_USER)).toEqual([ADMIN_SECTIONS.orders.path]);
  });

  it("shows orders and kitchen to a cook", () => {
    expect(visiblePaths(COOK_USER)).toEqual([ADMIN_SECTIONS.orders.path, ADMIN_SECTIONS.kitchen.path]);
  });

  it("shows availability to a cook who can mark products sold out", () => {
    const cook = { ...COOK_USER, permissions: [...COOK_USER.permissions, PERMISSIONS.SET_PRODUCT_AVAILABILITY] };

    expect(visiblePaths(cook)).toEqual([
      ADMIN_SECTIONS.orders.path,
      ADMIN_SECTIONS.kitchen.path,
      ADMIN_SECTIONS.availability.path,
    ]);
  });

  it("leaves availability out of the admin menu because it opens from Products", () => {
    const staffMenu = getMenuSections(STAFF_USER).map((section) => section.path);

    expect(staffMenu).toContain(ADMIN_SECTIONS.products.path);
    expect(staffMenu).not.toContain(ADMIN_SECTIONS.availability.path);
    expect(canAccessSection(ADMIN_SECTIONS.availability, STAFF_USER)).toBe(true);
  });

  it("leaves modifiers out of the menu because they open from Products", () => {
    const staffMenu = getMenuSections(STAFF_USER).map((section) => section.path);

    expect(staffMenu).not.toContain(ADMIN_SECTIONS.modifiers.path);
    expect(canAccessSection(ADMIN_SECTIONS.modifiers, STAFF_USER)).toBe(true);
  });

  it("highlights Products while the admin is in one of its pages", () => {
    const { products, availability, modifiers, tables } = ADMIN_SECTIONS;

    expect(isSectionActive(products, products.path)).toBe(true);
    expect(isSectionActive(products, modifiers.path)).toBe(true);
    expect(isSectionActive(products, availability.path)).toBe(true);
    expect(isSectionActive(availability, availability.path)).toBe(true);
    expect(isSectionActive(tables, modifiers.path)).toBe(false);
  });

  it("keeps availability in the kitchen menu", () => {
    const cook = { ...COOK_USER, permissions: [...COOK_USER.permissions, PERMISSIONS.MANAGE_STOCK] };

    expect(getMenuSections(cook).map((section) => section.path)).toContain(ADMIN_SECTIONS.availability.path);
  });

  it("shows nothing to a user without permissions", () => {
    expect(visiblePaths(USER_WITHOUT_ROLE)).toEqual([]);
  });

  it.each(ADMIN_ONLY_SECTIONS.map((section) => [section.path, section]))(
    "denies %s to a non-staff user even with every order permission",
    (_, section) => {
      const user = { is_staff: false, permissions: Object.values(PERMISSIONS) };
      expect(canAccessSection(section, user)).toBe(false);
    },
  );

  it("denies a permission-protected section when there is no user", () => {
    expect(canAccessSection(ADMIN_SECTIONS.orders, undefined)).toBe(false);
  });

  it("keeps the table detail out of the menu", () => {
    expect(ADMIN_MENU).not.toContain(ADMIN_SECTIONS.tableDetail);
  });

  it("builds the table detail path from its route pattern", () => {
    expect(tableDetailPath(7)).toBe("/admin/table/7");
  });

  it("builds the ticket path from its route pattern", () => {
    expect(billTicketPath(12)).toBe("/admin/bills/12/ticket");
  });

  it("shows the payments history to a cashier", () => {
    const cashier = {
      is_staff: false,
      permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.CHARGE_BILL, PERMISSIONS.VIEW_PAYMENTS],
    };

    expect(visiblePaths(cashier)).toEqual([ADMIN_SECTIONS.orders.path, ADMIN_SECTIONS.paymentsHistory.path]);
  });

  it("opens the ticket with permission to charge only", () => {
    const user = { is_staff: false, permissions: [PERMISSIONS.CHARGE_BILL] };

    expect(canAccessSection(ADMIN_SECTIONS.billTicket, user)).toBe(true);
  });

  it("opens the ticket with permission to view payments only", () => {
    const user = { is_staff: false, permissions: [PERMISSIONS.VIEW_PAYMENTS] };

    expect(canAccessSection(ADMIN_SECTIONS.billTicket, user)).toBe(true);
  });

  it("denies the ticket without either payment permission", () => {
    expect(canAccessSection(ADMIN_SECTIONS.billTicket, WAITER_USER)).toBe(false);
  });

  it.each(ALL_ADMIN_SECTIONS.map((section) => [section.path, section]))(
    "registers %s as a route with a page and the same access rules",
    (path, section) => {
      const route = routesAdmin.find((candidate) => candidate.path === path);

      expect(route.adminOnly).toBe(section.adminOnly);
      expect(route.requiredPermissions).toEqual(section.requiredPermissions);
      expect(route.component).toEqual(expect.any(Function));
    },
  );

  it("does not register admin routes outside the sections", () => {
    expect(routesAdmin).toHaveLength(ALL_ADMIN_SECTIONS.length);
  });
});
