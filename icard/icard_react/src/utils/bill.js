import { toCents } from "./money";
import { ORDER_STATUS } from "./orderStatus";
import { PAYMENT_MODE } from "./tax";

export function isPrepaidBill(bill) {
  return bill?.payment_mode === PAYMENT_MODE.PREPAID;
}

export function unpaidLines(bill) {
  return (bill?.lines ?? []).filter((line) => line.status === ORDER_STATUS.AWAITING_PAYMENT && !line.is_paid);
}

export function linesTotalCents(lines) {
  return lines.reduce((total, line) => total + toCents(line.line_total), 0);
}

export function canChargeBill(bill) {
  if (isPrepaidBill(bill)) return unpaidLines(bill).length > 0;
  return toCents(bill?.totals?.balance) > 0;
}
