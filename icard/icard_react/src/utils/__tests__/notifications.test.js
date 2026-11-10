import {
  NOTIFICATION_TYPE,
  buildNotifications,
  hasOrderNotifications,
  isAfter,
  latestCreatedAt,
} from "../notifications";

const LAST_SEEN = "2026-11-09T12:00:00.000Z";

function guestOrder(id, tableId, tableNumber, createdAt, quantity = 1) {
  return { id, table: tableId, table_data: { number: tableNumber }, created_at: createdAt, quantity };
}

const SUMMARY = [
  { id: 1, number: 5, bill_requested: false },
  { id: 2, number: 7, bill_requested: true },
];

describe("buildNotifications", () => {
  const texts = (notifications) => notifications.map((notification) => notification.text);

  it("groups new guest orders by table and counts the products", () => {
    const orders = [
      guestOrder(1, 1, 5, "2026-11-09T12:01:00.000000Z", 2),
      guestOrder(2, 1, 5, "2026-11-09T12:02:00.000000Z", 1),
    ];

    expect(texts(buildNotifications(orders, [], LAST_SEEN))).toEqual(["Mesa 5 hizo un pedido (3 productos)"]);
  });

  it("uses the singular for a single product", () => {
    const orders = [guestOrder(1, 1, 5, "2026-11-09T12:01:00Z")];

    expect(texts(buildNotifications(orders, [], LAST_SEEN))).toEqual(["Mesa 5 hizo un pedido (1 producto)"]);
  });

  it("ignores orders already seen", () => {
    const orders = [guestOrder(1, 1, 5, "2026-11-09T11:59:00Z"), guestOrder(2, 1, 5, LAST_SEEN)];

    expect(buildNotifications(orders, [], LAST_SEEN)).toEqual([]);
  });

  it("shows the table that ordered most recently first", () => {
    const orders = [
      guestOrder(1, 1, 5, "2026-11-09T12:01:00Z"),
      guestOrder(2, 3, 9, "2026-11-09T12:05:00Z"),
    ];

    expect(buildNotifications(orders, [], LAST_SEEN).map((notification) => notification.tableNumber)).toEqual([
      9, 5,
    ]);
  });

  it("puts bill requests before new orders", () => {
    const orders = [guestOrder(1, 1, 5, "2026-11-09T12:01:00Z")];
    const notifications = buildNotifications(orders, SUMMARY, LAST_SEEN);

    expect(notifications.map((notification) => notification.type)).toEqual([
      NOTIFICATION_TYPE.BILL,
      NOTIFICATION_TYPE.ORDER,
    ]);
    expect(notifications[0].text).toBe("Mesa 7 pide la cuenta");
  });

  it("links every notification to its table", () => {
    const orders = [guestOrder(1, 1, 5, "2026-11-09T12:01:00Z")];

    expect(buildNotifications(orders, SUMMARY, LAST_SEEN).map((notification) => notification.tableId)).toEqual([
      2, 1,
    ]);
  });

  it("skips orders whose table was deleted", () => {
    const orders = [{ ...guestOrder(1, null, null, "2026-11-09T12:01:00Z"), table_data: null }];

    expect(buildNotifications(orders, [], LAST_SEEN)).toEqual([]);
  });

  it("returns nothing before the data loads", () => {
    expect(buildNotifications(null, null, LAST_SEEN)).toEqual([]);
  });
});

describe("notification helpers", () => {
  it("finds the most recent order time", () => {
    const orders = [
      guestOrder(1, 1, 5, "2026-11-09T12:03:00Z"),
      guestOrder(2, 1, 5, "2026-11-09T12:09:00Z"),
      guestOrder(3, 1, 5, "2026-11-09T12:01:00Z"),
    ];

    expect(latestCreatedAt(orders)).toBe("2026-11-09T12:09:00Z");
  });

  it("has no latest time without orders", () => {
    expect(latestCreatedAt([])).toBeNull();
  });

  it("compares timestamps written with different precision", () => {
    expect(isAfter("2026-11-09T12:00:00.001500Z", "2026-11-09T12:00:00.000Z")).toBe(true);
  });

  it("detects when there are order notifications to mark as read", () => {
    expect(hasOrderNotifications([{ type: NOTIFICATION_TYPE.BILL }])).toBe(false);
    expect(hasOrderNotifications([{ type: NOTIFICATION_TYPE.ORDER }])).toBe(true);
  });
});
