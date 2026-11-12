import { ADMIN_HOME_PATH, DASHBOARD_PATH, landingPath } from "../adminSections";
import {
  HOUR_OPTIONS,
  describeChange,
  differenceColor,
  emptyCount,
  formatSignedMoney,
  paymentsAfterText,
  toCountPayload,
  validateCount,
} from "../reports";

describe("dashboard texts", () => {
  it("describes the change against the previous period", () => {
    expect(describeChange("12.5", "el lunes pasado")).toEqual({ text: "+12.5 % frente a el lunes pasado", color: "green" });
    expect(describeChange("-3.0", "x").color).toBe("red");
    expect(describeChange("0.0", "x").color).toBe("grey");
    expect(describeChange(null, "el mes pasado")).toEqual({ text: "Sin ventas en el mes pasado", color: "grey" });
  });

  it("counts the payments after the closing", () => {
    expect(paymentsAfterText(0)).toBeNull();
    expect(paymentsAfterText(1)).toBe("1 cobro después del cierre de caja");
    expect(paymentsAfterText(3)).toBe("3 cobros después del cierre de caja");
  });

  it("offers every hour of the day", () => {
    expect(HOUR_OPTIONS).toHaveLength(24);
    expect(HOUR_OPTIONS[14]).toEqual({ key: 14, value: 14, text: "14:00" });
  });
});

describe("cash count", () => {
  it("shows differences with sign and colour", () => {
    expect(formatSignedMoney("-1000.00")).toBe("-$1000.00");
    expect(formatSignedMoney("250.5")).toBe("+$250.50");
    expect(formatSignedMoney("0.00")).toBe("$0.00");
    expect([differenceColor("-1"), differenceColor("1"), differenceColor("0")]).toEqual(["red", "orange", "green"]);
  });

  it("sends empty amounts as zero and trims the note", () => {
    const draft = { ...emptyCount(), opening_float: " 100000 ", note: "  Ok " };
    draft.counted = { ...draft.counted, CASH: "130000" };

    expect(toCountPayload(draft)).toEqual({
      opening_float: "100000",
      counted: { CASH: "130000", CARD: "0", TRANSFER: "0" },
      note: "Ok",
    });
  });

  it("rejects amounts that are not money", () => {
    const draft = { ...emptyCount(), opening_float: "-5" };
    draft.counted = { ...draft.counted, CARD: "12.345" };

    expect(Object.keys(validateCount(draft))).toEqual(["opening_float", "CARD"]);
    expect(validateCount(emptyCount())).toEqual({});
  });
});

describe("landingPath", () => {
  it("sends the admin to the summary only from the panel home", () => {
    expect(landingPath({ is_staff: true }, ADMIN_HOME_PATH)).toBe(DASHBOARD_PATH);
    expect(landingPath({ is_staff: true }, "/admin/kitchen")).toBeNull();
    expect(landingPath({ is_staff: false }, ADMIN_HOME_PATH)).toBeNull();
  });
});
