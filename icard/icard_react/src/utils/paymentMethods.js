export const PAYMENT_METHOD = {
  CASH: "CASH",
  CARD: "CARD",
  TRANSFER: "TRANSFER",
};

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHOD.CASH]: "Efectivo",
  [PAYMENT_METHOD.CARD]: "Tarjeta",
  [PAYMENT_METHOD.TRANSFER]: "Transferencia",
};

export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, text]) => ({
  key: value,
  value,
  text,
}));

export const BILL_STATUS = {
  OPEN: "OPEN",
  PAID: "PAID",
};

export function needsReference(method) {
  return method === PAYMENT_METHOD.CARD || method === PAYMENT_METHOD.TRANSFER;
}
