import { PERMISSIONS, hasPermission } from "../permissions";

describe("hasPermission", () => {
  it("grants a permission listed for the user", () => {
    expect(hasPermission({ permissions: [PERMISSIONS.ADD_ORDER] }, PERMISSIONS.ADD_ORDER)).toBe(true);
  });

  it("denies a permission the user does not have", () => {
    expect(hasPermission({ permissions: [PERMISSIONS.VIEW_ORDER] }, PERMISSIONS.CANCEL_ORDER)).toBe(false);
  });

  it("grants every permission to staff", () => {
    expect(hasPermission({ is_staff: true, permissions: [] }, PERMISSIONS.CANCEL_ORDER)).toBe(true);
  });

  it("denies when the user has no permissions list", () => {
    expect(hasPermission({}, PERMISSIONS.VIEW_ORDER)).toBe(false);
  });

  it("denies when there is no user", () => {
    expect(hasPermission(null, PERMISSIONS.VIEW_ORDER)).toBe(false);
  });
});
