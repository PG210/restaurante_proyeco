import { formatCents, isValidMoney, toCents } from "./money";
import { PAYMENT_METHOD } from "./paymentMethods";

export const DASHBOARD_POLL_MS = 60000;
const HOURS_PER_DAY = 24;

export const DASHBOARD_PERIODS = [
  { key: "today", title: "Hoy", previous: "el mismo día de la semana pasada" },
  { key: "week", title: "Esta semana", previous: "los mismos días de la semana pasada" },
  { key: "month", title: "Este mes", previous: "los mismos días del mes pasado" },
];

export const SALES_NOTE =
  "Vendido = dinero cobrado en la jornada (sin propinas, con las anulaciones restando), incluidos los cobros anticipados de cuentas aún abiertas. El historial de pagos suma por cuenta cerrada, así que puede no coincidir.";

export const BUSINESS_DAY_HINT =
  "Elige una hora en la que el local esté cerrado. Ejemplo: si abres de 14:00 a 24:00, sirve cualquier hora entre las 0:00 y las 13:00.";
export const BUSINESS_DAY_WARNING =
  "Cambia qué día cuentan los cobros, el stock vendido y \"Agotado hoy\" a partir de ahora. Los cierres de caja ya guardados no cambian.";

export const COUNT_METHODS = [PAYMENT_METHOD.CASH, PAYMENT_METHOD.CARD, PAYMENT_METHOD.TRANSFER];
export const NOTE_REQUIRED_MESSAGE = "Hay diferencia: explica en una nota qué pasó.";

export function formatHour(hour) {
  return `${hour}:00`;
}

export const HOUR_OPTIONS = Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
  key: hour,
  value: hour,
  text: formatHour(hour),
}));

/** "+12,5 % frente a …" in green, "-3 % …" in red, nothing to compare with when there were no sales. */
export function describeChange(changePercent, previousLabel) {
  if (changePercent === null || changePercent === undefined) {
    return { text: `Sin ventas en ${previousLabel}`, color: "grey" };
  }
  const value = Number(changePercent);
  const sign = value > 0 ? "+" : "";
  const color = value > 0 ? "green" : value < 0 ? "red" : "grey";
  return { text: `${sign}${changePercent} % frente a ${previousLabel}`, color };
}

export function formatSignedMoney(value) {
  const cents = toCents(value);
  if (cents === 0) return formatCents(0);
  return `${cents > 0 ? "+" : "-"}${formatCents(Math.abs(cents))}`;
}

/** Red when money is missing, orange when there is more than expected. */
export function differenceColor(value) {
  const cents = toCents(value);
  if (cents < 0) return "red";
  if (cents > 0) return "orange";
  return "green";
}

export function paymentsAfterText(count) {
  if (!count) return null;
  return count === 1 ? "1 cobro después del cierre de caja" : `${count} cobros después del cierre de caja`;
}

export function emptyCount() {
  return { opening_float: "", counted: Object.fromEntries(COUNT_METHODS.map((method) => [method, ""])), note: "" };
}

export function toCountPayload(draft) {
  const amount = (value) => (String(value).trim() === "" ? "0" : String(value).trim());
  return {
    opening_float: amount(draft.opening_float),
    counted: Object.fromEntries(COUNT_METHODS.map((method) => [method, amount(draft.counted[method])])),
    note: draft.note.trim(),
  };
}

const INVALID_AMOUNT = "Escribe un monto válido, con hasta 2 decimales.";

export function validateCount(draft) {
  const invalid = (value) => String(value).trim() !== "" && !isValidMoney(value);
  const errors = {};
  if (invalid(draft.opening_float)) errors.opening_float = INVALID_AMOUNT;
  COUNT_METHODS.forEach((method) => {
    if (invalid(draft.counted[method])) errors[method] = INVALID_AMOUNT;
  });
  return errors;
}
