// Date ranges of the sales reports, as "YYYY-MM-DD" service days (both ends included).
// Dates are handled in UTC so a range never shifts with the browser's time zone.

export const MAX_RANGE_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const INVALID_DATE_MESSAGE = "Elige fechas válidas.";
export const INVERTED_RANGE_MESSAGE = 'La fecha "desde" no puede ser posterior a "hasta".';
export const RANGE_TOO_LONG_MESSAGE = `El rango no puede superar ${MAX_RANGE_DAYS} días.`;

function toUtc(isoDate) {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function fromUtc(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

export function isIsoDate(value) {
  if (!ISO_DATE_PATTERN.test(value ?? "") || Number.isNaN(toUtc(value))) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(isoDate, days) {
  return fromUtc(toUtc(isoDate) + days * MS_PER_DAY);
}

function monthStart(isoDate) {
  return `${isoDate.slice(0, 8)}01`;
}

export function rangeDays(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY) + 1;
}

/** Shortcuts relative to the restaurant's current service day. */
export function rangeShortcuts(today) {
  const thisMonth = monthStart(today);
  const lastMonthEnd = addDays(thisMonth, -1);
  return [
    { key: "today", label: "Hoy", from: today, to: today },
    { key: "week", label: "Últimos 7 días", from: addDays(today, -6), to: today },
    { key: "month", label: "Este mes", from: thisMonth, to: today },
    { key: "lastMonth", label: "Mes pasado", from: monthStart(lastMonthEnd), to: lastMonthEnd },
  ];
}

/** The message to show for a range the server would reject, or null when it is fine. */
export function rangeError(from, to) {
  if (!isIsoDate(from) || !isIsoDate(to)) return INVALID_DATE_MESSAGE;
  if (from > to) return INVERTED_RANGE_MESSAGE;
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return RANGE_TOO_LONG_MESSAGE;
  return null;
}
