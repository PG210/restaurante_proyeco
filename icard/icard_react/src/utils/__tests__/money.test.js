import { changeDueCents, formatCents, formatMoney, fromCents, isValidMoney, toCents } from "../money";

describe("money", () => {
  it("adds amounts without floating point errors", () => {
    expect(fromCents(toCents("0.1") + toCents("0.2"))).toBe("0.30");
  });

  it.each([
    ["21.00", 2100],
    ["4.5", 450],
    ["0.29", 29],
    ["", 0],
    [null, 0],
  ])("converts %p to %i cents", (value, cents) => {
    expect(toCents(value)).toBe(cents);
  });

  it.each(["10", "10.5", "10.50", "0.01"])("accepts %s as a valid amount", (value) => {
    expect(isValidMoney(value)).toBe(true);
  });

  it.each(["10.505", "-1", "abc", "", "1,50"])("rejects %p as an amount", (value) => {
    expect(isValidMoney(value)).toBe(false);
  });

  it("formats with two decimals", () => {
    expect(formatMoney("7")).toBe("$7.00");
    expect(formatCents(1999)).toBe("$19.99");
  });

  it("calculates the change for a cash payment", () => {
    expect(formatCents(changeDueCents("50", "21.30"))).toBe("$28.70");
  });

  it("never returns negative change", () => {
    expect(changeDueCents("10", "21.30")).toBe(0);
  });
});
