import { HEAT_LEVELS, barPercent, busyHours, heatLevel, maxAmount, sortRows } from "../salesReports";

describe("sales report helpers", () => {
  it("sizes bars and heat against the largest value", () => {
    expect(barPercent("50.00", "200.00")).toBe(25);
    expect(barPercent("10.00", "0")).toBe(0);
    expect(heatLevel("0", "200.00")).toBe(0);
    expect(heatLevel("1.00", "200.00")).toBe(1);
    expect(heatLevel("200.00", "200.00")).toBe(HEAT_LEVELS);
  });

  it("finds the largest amount", () => {
    expect(maxAmount([{ amount: "9.50" }, { amount: "20.00" }, { amount: "3.00" }])).toBe("20.00");
    expect(maxAmount([])).toBe("0");
  });

  it("shows only the hours between the first and the last with orders", () => {
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: [12, 15].includes(hour) ? 2 : 0 }));

    expect(busyHours(byHour)).toEqual([12, 13, 14, 15]);
    expect(busyHours(byHour.map((row) => ({ ...row, orders: 0 })))).toEqual([]);
  });

  it("sorts by name or by number without changing the original rows", () => {
    const rows = [
      { name: "Jugo", amount: "4000.00" },
      { name: "Café", amount: "9500.00" },
    ];

    expect(sortRows(rows, "amount", "descending").map((row) => row.name)).toEqual(["Café", "Jugo"]);
    expect(sortRows(rows, "name", "ascending").map((row) => row.name)).toEqual(["Café", "Jugo"]);
    expect(rows[0].name).toBe("Jugo");
  });
});
