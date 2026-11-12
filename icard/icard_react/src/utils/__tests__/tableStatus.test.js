import { TABLE_STATE, getTableState } from "../orderStatus";
import { getTableBadges } from "../tableStatus";

const OPEN_FREE_TABLE = { is_open: true, bill_requested: false, pending: 0, preparing: 0, ready: 0 };

describe("table badges", () => {
  const texts = (table) => getTableBadges(table).map((badge) => badge.text);

  it("shows nothing for an open table without orders", () => {
    expect(texts(OPEN_FREE_TABLE)).toEqual([]);
  });

  it("marks a closed table", () => {
    expect(texts({ ...OPEN_FREE_TABLE, is_open: false })).toEqual(["Cerrada"]);
  });

  it("puts the bill request first so it stands out", () => {
    expect(texts({ ...OPEN_FREE_TABLE, bill_requested: true, pending: 2 })).toEqual([
      "Pide la cuenta",
      "2 pendientes",
    ]);
  });

  it("gives every badge a unique key", () => {
    const badges = getTableBadges({ is_open: false, bill_requested: true, pending: 1, preparing: 1, ready: 1 });
    const keys = badges.map((badge) => badge.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("table state with bill requests", () => {
  it("prioritises a bill request over ready orders", () => {
    expect(getTableState({ ...OPEN_FREE_TABLE, ready: 2, bill_requested: true })).toBe(TABLE_STATE.BILL);
  });
});

describe("waiter calls on the table", () => {
  const calling = { ...OPEN_FREE_TABLE, waiter_called: true, pending: 1 };

  it("shows the call before everything else", () => {
    expect(getTableBadges({ ...calling, bill_requested: true }).map((badge) => badge.text)).toEqual([
      "Llama al mesero",
      "Pide la cuenta",
      "1 pendiente",
    ]);
  });

  it("highlights the card, after a bill request", () => {
    expect(getTableState(calling)).toBe(TABLE_STATE.WAITER);
    expect(getTableState({ ...calling, bill_requested: true })).toBe(TABLE_STATE.BILL);
  });
});
