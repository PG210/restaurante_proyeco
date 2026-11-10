const CENTS_PER_UNIT = 100;
const MONEY_DECIMALS = 2;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export function isValidMoney(value) {
  return MONEY_PATTERN.test(String(value ?? "").trim());
}

export function toCents(value) {
  return Math.round(Number(value || 0) * CENTS_PER_UNIT);
}

export function fromCents(cents) {
  return (cents / CENTS_PER_UNIT).toFixed(MONEY_DECIMALS);
}

export function formatCents(cents) {
  return `$${fromCents(cents)}`;
}

export function formatMoney(value) {
  return formatCents(toCents(value));
}

export function changeDueCents(receivedValue, amountValue) {
  return Math.max(toCents(receivedValue) - toCents(amountValue), 0);
}
