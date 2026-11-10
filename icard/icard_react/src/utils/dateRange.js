function pad(value) {
  return String(value).padStart(2, "0");
}

export function toDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, monthIndex: month - 1, day };
}

export function startOfLocalDayIso(value) {
  const { year, monthIndex, day } = parseDateInput(value);
  return new Date(year, monthIndex, day, 0, 0, 0, 0).toISOString();
}

export function endOfLocalDayIso(value) {
  const { year, monthIndex, day } = parseDateInput(value);
  return new Date(year, monthIndex, day, 23, 59, 59, 999).toISOString();
}

export function formatDateTime(isoValue) {
  if (!isoValue) return "";
  return new Date(isoValue).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}
