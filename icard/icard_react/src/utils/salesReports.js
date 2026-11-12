import { toCents } from "./money";

export const REPORT_TABS = [
  { key: "products", label: "Productos" },
  { key: "categories", label: "Categorías" },
  { key: "hours", label: "Horas" },
  { key: "staff", label: "Personal" },
  { key: "cancellations", label: "Cancelaciones" },
];

export const DEFAULT_REPORT = REPORT_TABS[0].key;

export const CONSUMPTION_NOTE =
  "Consumo de los pedidos no cancelados, por la jornada en que se pidieron. Incluye cuentas abiertas, así que puede no coincidir con lo cobrado en el Resumen o en el historial de pagos.";
export const CURRENT_NAMES_NOTE =
  "Se muestran el nombre y la categoría actuales de cada producto: si se renombró, aparece con el nombre nuevo.";
export const HOURS_NOTE =
  "Hora del reloj: un pedido a la 1:00 del sábado aparece en sábado aunque pertenezca a la jornada del viernes.";
export const STAFF_NOTE =
  "Las mesas no tienen mesero asignado: el consumo se atribuye a quien cargó el pedido y las propinas a quien cobró.";
export const CANCELLATIONS_NOTE =
  "Pedidos hechos en estas fechas que se cancelaron. Los motivos iguales se agrupan sin importar mayúsculas.";
export const EMPTY_REPORT_MESSAGE = "Sin pedidos en estas fechas.";

export const WEEKDAYS = [
  { number: 1, label: "Lunes", short: "Lun" },
  { number: 2, label: "Martes", short: "Mar" },
  { number: 3, label: "Miércoles", short: "Mié" },
  { number: 4, label: "Jueves", short: "Jue" },
  { number: 5, label: "Viernes", short: "Vie" },
  { number: 6, label: "Sábado", short: "Sáb" },
  { number: 7, label: "Domingo", short: "Dom" },
];

export const HEAT_LEVELS = 4;

export function isReportKey(value) {
  return REPORT_TABS.some((tab) => tab.key === value);
}

/** Percentage (0–100) of a value against the largest one, for the bars. */
export function barPercent(value, max) {
  const maxCents = toCents(max);
  if (maxCents <= 0) return 0;
  return Math.round((toCents(value) / maxCents) * 100);
}

/** Heat level from 0 (nothing) to HEAT_LEVELS (the busiest cell). */
export function heatLevel(value, max) {
  const percent = barPercent(value, max);
  if (percent === 0) return 0;
  return Math.max(1, Math.ceil((percent / 100) * HEAT_LEVELS));
}

export function maxAmount(rows, field = "amount") {
  return rows.reduce((max, row) => (Number(row[field]) > Number(max) ? row[field] : max), "0");
}

export function formatHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Hours from the first to the last one with orders, so closed hours at the ends are not shown. */
export function busyHours(byHour) {
  const busy = byHour.filter((row) => row.orders > 0).map((row) => row.hour);
  if (!busy.length) return [];
  const first = Math.min(...busy);
  const last = Math.max(...busy);
  return byHour.filter((row) => row.hour >= first && row.hour <= last).map((row) => row.hour);
}

export function sortRows(rows, column, direction) {
  const factor = direction === "ascending" ? 1 : -1;
  const compare =
    column === "name"
      ? (a, b) => a.name.localeCompare(b.name, "es")
      : (a, b) => Number(a[column]) - Number(b[column]);
  return [...rows].sort((a, b) => compare(a, b) * factor);
}

/** Saves a downloaded file in the browser. */
export function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
