import { buildDrafts, draftFor, hasSamePermissions, togglePermission } from "../permissionMatrix";

const MATRIX = {
  permissions: [],
  roles: [
    { name: "mesero", permissions: ["view_order", "add_order"], defaults: ["add_order", "view_order"] },
    { name: "caja", permissions: [], defaults: ["view_order"] },
  ],
};

describe("permission matrix helpers", () => {
  it("builds one sorted draft per role", () => {
    expect(buildDrafts(MATRIX)).toEqual({ mesero: ["add_order", "view_order"], caja: [] });
  });

  it("returns no drafts before the matrix loads", () => {
    expect(buildDrafts(null)).toEqual({});
  });

  it("falls back to the saved permissions when a role has no draft", () => {
    expect(draftFor({}, MATRIX.roles[0])).toEqual(["view_order", "add_order"]);
  });

  it("adds a permission that is not granted", () => {
    expect(togglePermission(["view_order"], "cancel_order")).toEqual(["cancel_order", "view_order"]);
  });

  it("removes a permission that is granted", () => {
    expect(togglePermission(["cancel_order", "view_order"], "cancel_order")).toEqual(["view_order"]);
  });

  it("does not mutate the original list", () => {
    const permissions = ["view_order"];
    togglePermission(permissions, "add_order");
    expect(permissions).toEqual(["view_order"]);
  });

  it("treats lists with the same permissions in another order as equal", () => {
    expect(hasSamePermissions(["add_order", "view_order"], ["view_order", "add_order"])).toBe(true);
  });

  it("detects a different set of permissions", () => {
    expect(hasSamePermissions(["view_order"], ["add_order"])).toBe(false);
  });
});
