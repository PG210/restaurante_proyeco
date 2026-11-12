import {
  INVALID_DATE_MESSAGE,
  INVERTED_RANGE_MESSAGE,
  MAX_RANGE_DAYS,
  RANGE_TOO_LONG_MESSAGE,
  addDays,
  rangeDays,
  rangeError,
  rangeShortcuts,
} from "../reportRange";

describe("report ranges", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-11-11", -11)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts both ends", () => {
    expect(rangeDays("2026-11-05", "2026-11-11")).toBe(7);
    expect(rangeDays("2026-11-11", "2026-11-11")).toBe(1);
  });

  it("offers shortcuts from the restaurant's current day", () => {
    const shortcuts = Object.fromEntries(rangeShortcuts("2026-03-10").map((s) => [s.key, [s.from, s.to]]));

    expect(shortcuts).toEqual({
      today: ["2026-03-10", "2026-03-10"],
      week: ["2026-03-04", "2026-03-10"],
      month: ["2026-03-01", "2026-03-10"],
      lastMonth: ["2026-02-01", "2026-02-28"],
    });
  });

  it("explains what is wrong with a range the server would reject", () => {
    expect(rangeError("2026-11-01", "2026-11-11")).toBeNull();
    expect(rangeError("", "2026-11-11")).toBe(INVALID_DATE_MESSAGE);
    expect(rangeError("2026-02-30", "2026-03-01")).toBe(INVALID_DATE_MESSAGE);
    expect(rangeError("2026-11-12", "2026-11-11")).toBe(INVERTED_RANGE_MESSAGE);
    expect(rangeError(addDays("2026-11-11", -MAX_RANGE_DAYS + 1), "2026-11-11")).toBeNull();
    expect(rangeError(addDays("2026-11-11", -MAX_RANGE_DAYS), "2026-11-11")).toBe(RANGE_TOO_LONG_MESSAGE);
  });
});
