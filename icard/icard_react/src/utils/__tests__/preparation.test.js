import { KITCHEN_LATE_MINUTES } from "../constants";
import { ORDER_STATUS, kitchenSince, kitchenTiming } from "../orderStatus";
import { MAX_PREPARATION_MINUTES, menuPreparationText, preparationCell } from "../preparation";

const CREATED_AT = "2026-11-11T12:00:00Z";
const MINUTE = 60000;

function at(minutes) {
  return new Date(CREATED_AT).getTime() + minutes * MINUTE;
}

function order(overrides = {}) {
  return { status: ORDER_STATUS.PENDING, created_at: CREATED_AT, kitchen_at: CREATED_AT, preparation_minutes: 20, ...overrides };
}

describe("kitchenTiming", () => {
  it("is on time until the estimate is exceeded", () => {
    expect(kitchenTiming(order(), at(20))).toEqual({ waiting: 20, estimate: 20, overdue: 0, late: false });
    expect(kitchenTiming(order(), at(25))).toEqual({ waiting: 25, estimate: 20, overdue: 5, late: true });
  });

  it("warns early for quick products and late for slow ones", () => {
    expect(kitchenTiming(order({ preparation_minutes: 5 }), at(6)).late).toBe(true);
    expect(kitchenTiming(order({ preparation_minutes: 40 }), at(KITCHEN_LATE_MINUTES + 5)).late).toBe(false);
  });

  it("uses the estimate while preparing too", () => {
    expect(kitchenTiming(order({ status: ORDER_STATUS.PREPARING }), at(21)).overdue).toBe(1);
  });

  it("keeps the fixed limit without a time or once the order is ready", () => {
    for (const changes of [{ preparation_minutes: null }, { status: ORDER_STATUS.READY }]) {
      const timing = kitchenTiming(order(changes), at(KITCHEN_LATE_MINUTES));
      expect(timing).toMatchObject({ estimate: null, overdue: 0, late: true });
      expect(kitchenTiming(order(changes), at(KITCHEN_LATE_MINUTES - 1)).late).toBe(false);
    }
  });

  it("counts from when a prepaid order was paid, not from when it was created", () => {
    const paid = order({ kitchen_at: new Date(at(28)).toISOString() });

    expect(kitchenTiming(paid, at(30))).toMatchObject({ waiting: 2, late: false });
  });

  it("falls back to the creation time without a kitchen entry", () => {
    expect(kitchenSince(order({ kitchen_at: null }))).toBe(CREATED_AT);
  });
});

describe("preparation texts", () => {
  it("shows the minutes or the empty marker in the admin table", () => {
    expect(preparationCell(20)).toBe("20 min");
    expect(preparationCell(null)).toBe("—");
  });

  it("shows an approximate time in the menu only when there is one", () => {
    expect(menuPreparationText(MAX_PREPARATION_MINUTES)).toBe(`≈ ${MAX_PREPARATION_MINUTES} min`);
    expect(menuPreparationText(null)).toBeNull();
    expect(menuPreparationText(undefined)).toBeNull();
  });
});
