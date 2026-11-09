import { KITCHEN_LATE_MINUTES } from "../constants";
import {
  BULK_ADVANCE_LABELS,
  DEFAULT_BULK_ADVANCE_LABEL,
  ORDER_STATUS,
  ORDER_STATUS_COLORS,
  TABLE_STATE,
  canAdvanceOrder,
  formatWaitingTime,
  getAdvancePermission,
  getBulkAdvanceLabel,
  getNextStatus,
  getTableState,
  getTableSummaryLabels,
  getWaitingMinutes,
  isLate,
} from "../orderStatus";
import { PERMISSIONS } from "../permissions";

const CREATED_AT = "2026-11-09T12:00:00Z";
const minutesAfterCreation = (minutes) => new Date(CREATED_AT).getTime() + minutes * 60000;

describe("order status flow", () => {
  it.each([
    [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING],
    [ORDER_STATUS.PREPARING, ORDER_STATUS.READY],
    [ORDER_STATUS.READY, ORDER_STATUS.DELIVERED],
  ])("moves %s to %s", (status, expected) => {
    expect(getNextStatus(status)).toBe(expected);
  });

  it.each([ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED])("does not advance a %s order", (status) => {
    expect(getNextStatus(status)).toBeNull();
    expect(getAdvancePermission(status)).toBeNull();
  });

  it("requires the prepare permission to start preparing", () => {
    expect(getAdvancePermission(ORDER_STATUS.PENDING)).toBe(PERMISSIONS.PREPARE_ORDER);
  });

  it("requires the deliver permission to deliver a ready order", () => {
    expect(getAdvancePermission(ORDER_STATUS.READY)).toBe(PERMISSIONS.DELIVER_ORDER);
  });
});

describe("bulk advance label", () => {
  const order = (status) => ({ status });

  it.each([
    [ORDER_STATUS.PENDING, BULK_ADVANCE_LABELS[ORDER_STATUS.PREPARING]],
    [ORDER_STATUS.PREPARING, BULK_ADVANCE_LABELS[ORDER_STATUS.READY]],
    [ORDER_STATUS.READY, BULK_ADVANCE_LABELS[ORDER_STATUS.DELIVERED]],
  ])("labels a selection of %s orders as %s", (status, expected) => {
    expect(getBulkAdvanceLabel([order(status), order(status)])).toBe(expected);
  });

  it("names the action for pending orders 'Enviar a preparar'", () => {
    expect(getBulkAdvanceLabel([order(ORDER_STATUS.PENDING)])).toBe("Enviar a preparar");
  });

  it("falls back to the generic label for mixed statuses", () => {
    expect(getBulkAdvanceLabel([order(ORDER_STATUS.PENDING), order(ORDER_STATUS.READY)])).toBe(
      DEFAULT_BULK_ADVANCE_LABEL,
    );
  });

  it("falls back to the generic label for an empty selection", () => {
    expect(getBulkAdvanceLabel([])).toBe(DEFAULT_BULK_ADVANCE_LABEL);
  });

  it("has a specific label for every status that can be advanced to", () => {
    const reachableStatuses = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY].map(getNextStatus);
    expect(Object.keys(BULK_ADVANCE_LABELS).sort()).toEqual([...reachableStatuses].sort());
  });
});

describe("canAdvanceOrder", () => {
  it("allows a cook to advance a pending order", () => {
    const cook = { permissions: [PERMISSIONS.PREPARE_ORDER] };
    expect(canAdvanceOrder({ status: ORDER_STATUS.PENDING }, cook)).toBe(true);
  });

  it("does not allow a cook to deliver", () => {
    const cook = { permissions: [PERMISSIONS.PREPARE_ORDER] };
    expect(canAdvanceOrder({ status: ORDER_STATUS.READY }, cook)).toBe(false);
  });

  it("does not allow anyone to advance a delivered order", () => {
    expect(canAdvanceOrder({ status: ORDER_STATUS.DELIVERED }, { is_staff: true })).toBe(false);
  });
});

describe("kitchen waiting time", () => {
  it("counts whole minutes since creation", () => {
    expect(getWaitingMinutes(CREATED_AT, minutesAfterCreation(7.9))).toBe(7);
  });

  it.each([
    [0, "0 min"],
    [59, "59 min"],
    [60, "1 h"],
    [125, "2 h 5 min"],
    [1439, "23 h 59 min"],
    [1440, "1 d"],
    [577680, "401 d"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatWaitingTime(minutes)).toBe(expected);
  });

  it("never shows a negative waiting time when the clocks differ", () => {
    expect(formatWaitingTime(-3)).toBe("0 min");
  });

  it("is not late one minute before the limit", () => {
    expect(isLate(CREATED_AT, minutesAfterCreation(KITCHEN_LATE_MINUTES - 1))).toBe(false);
  });

  it("is late exactly at the limit", () => {
    expect(isLate(CREATED_AT, minutesAfterCreation(KITCHEN_LATE_MINUTES))).toBe(true);
  });
});

describe("table state", () => {
  it("is free without open orders", () => {
    expect(getTableState({ pending: 0, preparing: 0, ready: 0 })).toBe(TABLE_STATE.FREE);
  });

  it("is pending when orders were taken but the kitchen has not started", () => {
    expect(getTableState({ pending: 2, preparing: 0, ready: 0 })).toBe(TABLE_STATE.PENDING);
  });

  it("is preparing when the kitchen is working on at least one order", () => {
    expect(getTableState({ pending: 1, preparing: 2, ready: 0 })).toBe(TABLE_STATE.PREPARING);
  });

  it("prioritises orders ready to serve", () => {
    expect(getTableState({ pending: 3, preparing: 1, ready: 1 })).toBe(TABLE_STATE.READY);
  });
});

describe("table summary labels", () => {
  const texts = (table) => getTableSummaryLabels(table).map((label) => label.text);

  it("shows pending and preparing orders as separate labels", () => {
    expect(texts({ pending: 2, preparing: 1, ready: 0 })).toEqual(["1 en preparación", "2 pendientes"]);
  });

  it("uses the singular for a single order", () => {
    expect(texts({ pending: 1, preparing: 0, ready: 1 })).toEqual(["1 listo", "1 pendiente"]);
  });

  it("uses the plural for several orders", () => {
    expect(texts({ pending: 0, preparing: 0, ready: 3 })).toEqual(["3 listos"]);
  });

  it("shows no labels for a free table", () => {
    expect(texts({ pending: 0, preparing: 0, ready: 0 })).toEqual([]);
  });

  it("colours each label like the order status in the table detail", () => {
    const labels = getTableSummaryLabels({ pending: 1, preparing: 1, ready: 1 });

    expect(labels.map((label) => label.color)).toEqual(labels.map((label) => ORDER_STATUS_COLORS[label.status]));
  });

  it("never merges pending orders into the in-progress count", () => {
    const statuses = getTableSummaryLabels({ pending: 1, preparing: 1, ready: 0 }).map((label) => label.status);

    expect(statuses).toEqual([ORDER_STATUS.PREPARING, ORDER_STATUS.PENDING]);
  });
});
