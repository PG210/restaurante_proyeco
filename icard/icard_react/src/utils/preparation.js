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
