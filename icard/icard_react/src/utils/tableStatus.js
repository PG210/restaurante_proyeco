import { getTableSummaryLabels } from "./orderStatus";

export const WAITER_CALLED_TEXT = "Llama al mesero";

export function waiterCallLabel(table) {
  return `Mesa ${table.number} llama al mesero`;
}

export function getTableBadges(table, { includeClosed = true } = {}) {
  const badges = [];
  if (table.waiter_called) badges.push({ key: "waiter", color: "yellow", text: WAITER_CALLED_TEXT });
  if (table.bill_requested) badges.push({ key: "bill", color: "red", text: "Pide la cuenta" });
  if (includeClosed && !table.is_open) badges.push({ key: "closed", color: "grey", basic: true, text: "Cerrada" });
  return [...badges, ...getTableSummaryLabels(table).map((label) => ({ key: label.status, ...label }))];
}

export function closeTableConfirmation(table) {
  return `¿Cerrar la mesa ${table.number}? Los clientes ya no podrán pedir desde el QR.`;
}
