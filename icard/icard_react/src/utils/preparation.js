import { EMPTY_VALUE } from "./constants";

export const MIN_PREPARATION_MINUTES = 1;
export const MAX_PREPARATION_MINUTES = 240;
export const PREPARATION_MESSAGE = `Escribe minutos enteros entre ${MIN_PREPARATION_MINUTES} y ${MAX_PREPARATION_MINUTES}`;

function hasMinutes(minutes) {
  return Number.isInteger(minutes) && minutes > 0;
}

/** Admin table: "20 min" or the empty marker. */
export function preparationCell(minutes) {
  return hasMinutes(minutes) ? `${minutes} min` : EMPTY_VALUE;
}

/** Customer menu: "≈ 20 min", or null when the product has no time. */
export function menuPreparationText(minutes) {
  return hasMinutes(minutes) ? `≈ ${minutes} min` : null;
}

const MINUTES_PER_HOUR = 60;

/** Kitchen report: "12.5 min", "1 h 05 min", or the empty marker when there is no figure. */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return EMPTY_VALUE;
  if (minutes < MINUTES_PER_HOUR) return `${Number(minutes.toFixed(1))} min`;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / MINUTES_PER_HOUR);
  return `${hours} h ${String(rounded % MINUTES_PER_HOUR).padStart(2, "0")} min`;
}
