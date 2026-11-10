import { endOfLocalDayIso, startOfLocalDayIso, toDateInputValue } from "../dateRange";

describe("date range", () => {
  it("formats a local date for a date input", () => {
    expect(toDateInputValue(new Date(2026, 10, 9, 23, 30))).toBe("2026-11-09");
  });

  it("starts the day at local midnight, not UTC midnight", () => {
    const start = new Date(startOfLocalDayIso("2026-11-09"));

    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()]).toEqual([
      2026, 10, 9, 0, 0,
    ]);
  });

  it("ends the day at the last local millisecond", () => {
    const end = new Date(endOfLocalDayIso("2026-11-09"));

    expect([end.getDate(), end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([
      9, 23, 59, 59, 999,
    ]);
  });

  it("sends the range with an explicit time zone", () => {
    expect(startOfLocalDayIso("2026-11-09")).toMatch(/Z$/);
  });
});
