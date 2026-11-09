import { EMPTY_VALUE } from "../constants";
import { formatRoles } from "../roles";

describe("formatRoles", () => {
  it("translates role keys to their labels", () => {
    expect(formatRoles(["mesero", "caja"])).toBe("Mesero, Caja");
  });

  it("shows the raw key for a role without a label", () => {
    expect(formatRoles(["gerente"])).toBe("gerente");
  });

  it("shows the empty placeholder when the user has no roles", () => {
    expect(formatRoles([])).toBe(EMPTY_VALUE);
  });
});
