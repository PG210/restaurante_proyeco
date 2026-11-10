import { groupOrdersByStatus } from "../../components/Admin/Order/KitchenBoard/KitchenBoard";
import { hasAwaitingPayment } from "../../pages/Customer/CustomerOrders";
import { NOTIFICATION_TYPE, buildNotifications } from "../notifications";
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  TABLE_STATE,
  canAdvanceOrder,
  getTableState,
  getTableSummaryLabels,
  isOpenStatus,
} from "../orderStatus";

const EMPTY_TABLE = { pending: 0, preparing: 0, ready: 0, awaiting_payment: 0, bill_requested: false };

describe("awaiting payment status", () => {
  it("is labelled as waiting to be charged", () => {
    expect(ORDER_STATUS_LABELS[ORDER_STATUS.AWAITING_PAYMENT]).toBe("Por cobrar");
  });

  it("cannot be advanced by anyone", () => {
    expect(canAdvanceOrder({ status: ORDER_STATUS.AWAITING_PAYMENT }, { is_staff: true })).toBe(false);
  });

  it("is still an open order that can be cancelled", () => {
    expect(isOpenStatus(ORDER_STATUS.AWAITING_PAYMENT)).toBe(true);
  });

  it("is left out of the kitchen board", () => {
    const columns = groupOrdersByStatus([{ id: 1, status: ORDER_STATUS.AWAITING_PAYMENT }]);

    expect(columns.flatMap((column) => column.orders)).toEqual([]);
  });

  it("is counted on the table card", () => {
    const texts = getTableSummaryLabels({ ...EMPTY_TABLE, awaiting_payment: 2 }).map((label) => label.text);

    expect(texts).toEqual(["2 por cobrar"]);
  });

  it("gives the table its own state when nothing else is going on", () => {
    expect(getTableState({ ...EMPTY_TABLE, awaiting_payment: 1 })).toBe(TABLE_STATE.AWAITING_PAYMENT);
  });

  it("does not hide orders already in the kitchen", () => {
    expect(getTableState({ ...EMPTY_TABLE, awaiting_payment: 1, preparing: 1 })).toBe(TABLE_STATE.PREPARING);
  });

  it("tells the guest to pay at the counter", () => {
    expect(hasAwaitingPayment([{ status: ORDER_STATUS.AWAITING_PAYMENT }])).toBe(true);
    expect(hasAwaitingPayment([{ status: ORDER_STATUS.PENDING }])).toBe(false);
  });
});

describe("payment notifications", () => {
  const SUMMARY = [{ id: 3, number: 8, bill_requested: false, awaiting_payment: 2 }];

  it("tells whoever can charge which table has orders to charge", () => {
    const notifications = buildNotifications([], SUMMARY, "2026-11-10T00:00:00Z", { includePayments: true });

    expect(notifications).toEqual([
      expect.objectContaining({
        type: NOTIFICATION_TYPE.PAYMENT,
        tableId: 3,
        text: "Mesa 8 tiene 2 pedidos por cobrar",
      }),
    ]);
  });

  it("uses the singular for one order", () => {
    const summary = [{ ...SUMMARY[0], awaiting_payment: 1 }];
    const [notification] = buildNotifications([], summary, "2026-11-10T00:00:00Z", { includePayments: true });

    expect(notification.text).toBe("Mesa 8 tiene 1 pedido por cobrar");
  });

  it("is not shown to users who cannot charge", () => {
    expect(buildNotifications([], SUMMARY, "2026-11-10T00:00:00Z")).toEqual([]);
  });
});
