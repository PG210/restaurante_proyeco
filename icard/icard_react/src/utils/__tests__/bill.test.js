import { canChargeBill, isPrepaidBill, linesTotalCents, unpaidLines } from "../bill";

const LINES = [
  { id: 1, status: "AWAITING_PAYMENT", is_paid: false, line_total: "30000.00" },
  { id: 2, status: "PENDING", is_paid: true, line_total: "5000.00" },
  { id: 3, status: "AWAITING_PAYMENT", is_paid: false, line_total: "5000.00" },
  { id: 4, status: "CANCELLED", is_paid: false, line_total: "8000.00" },
];

const PREPAID_BILL = { payment_mode: "PREPAID", lines: LINES, totals: { balance: "35000.00" } };
const POSTPAID_BILL = { payment_mode: "POSTPAID", lines: [], totals: { balance: "12.00" } };

describe("bill helpers", () => {
  it("detects a prepaid bill", () => {
    expect(isPrepaidBill(PREPAID_BILL)).toBe(true);
    expect(isPrepaidBill(POSTPAID_BILL)).toBe(false);
  });

  it("lists only the orders still waiting for payment", () => {
    expect(unpaidLines(PREPAID_BILL).map((line) => line.id)).toEqual([1, 3]);
  });

  it("adds up line totals in cents", () => {
    expect(linesTotalCents(unpaidLines(PREPAID_BILL))).toBe(3500000);
  });

  it("lets a prepaid bill be charged while orders wait for payment", () => {
    expect(canChargeBill(PREPAID_BILL)).toBe(true);
  });

  it("does not charge a prepaid bill with everything paid", () => {
    expect(canChargeBill({ ...PREPAID_BILL, lines: [LINES[1]] })).toBe(false);
  });

  it("charges a postpaid bill while it has a balance", () => {
    expect(canChargeBill(POSTPAID_BILL)).toBe(true);
    expect(canChargeBill({ ...POSTPAID_BILL, totals: { balance: "0.00" } })).toBe(false);
  });
});
