import { KITCHEN_LATE_MINUTES } from "./constants";
import { PERMISSIONS, hasPermission } from "./permissions";

const MILLISECONDS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export const ORDER_STATUS = {
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

export const KITCHEN_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING, ORDER_STATUS.READY];

export const OPEN_ORDER_STATUSES = [ORDER_STATUS.AWAITING_PAYMENT, ...KITCHEN_STATUSES];

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.AWAITING_PAYMENT]: "Por cobrar",
  [ORDER_STATUS.PENDING]: "Pendiente",
  [ORDER_STATUS.PREPARING]: "En preparación",
  [ORDER_STATUS.READY]: "Listo",
  [ORDER_STATUS.DELIVERED]: "Entregado",
  [ORDER_STATUS.CANCELLED]: "Cancelado",
};

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUS.AWAITING_PAYMENT]: "yellow",
  [ORDER_STATUS.PENDING]: "grey",
  [ORDER_STATUS.PREPARING]: "orange",
  [ORDER_STATUS.READY]: "green",
  [ORDER_STATUS.DELIVERED]: "blue",
  [ORDER_STATUS.CANCELLED]: "red",
};

const NEXT_STATUS = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS.PREPARING,
  [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
  [ORDER_STATUS.READY]: ORDER_STATUS.DELIVERED,
};

const ADVANCE_PERMISSIONS = {
  [ORDER_STATUS.PREPARING]: PERMISSIONS.PREPARE_ORDER,
  [ORDER_STATUS.READY]: PERMISSIONS.PREPARE_ORDER,
  [ORDER_STATUS.DELIVERED]: PERMISSIONS.DELIVER_ORDER,
};

export const ADVANCE_ACTION_LABELS = {
  [ORDER_STATUS.PREPARING]: "Preparar",
  [ORDER_STATUS.READY]: "Marcar listo",
  [ORDER_STATUS.DELIVERED]: "Entregar",
};

export const BULK_ADVANCE_LABELS = {
  [ORDER_STATUS.PREPARING]: "Enviar a preparar",
  [ORDER_STATUS.READY]: "Marcar listos",
  [ORDER_STATUS.DELIVERED]: "Entregar",
};

export const DEFAULT_BULK_ADVANCE_LABEL = "Avanzar seleccionados";

export const TABLE_STATE = {
  AWAITING_PAYMENT: "awaiting",
  BILL: "bill",
  WAITER: "waiter",
  FREE: "free",
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
};

const TABLE_SUMMARY_COUNTERS = [
  { field: "ready", status: ORDER_STATUS.READY, singular: "listo", plural: "listos" },
  { field: "preparing", status: ORDER_STATUS.PREPARING, singular: "en preparación", plural: "en preparación" },
  { field: "pending", status: ORDER_STATUS.PENDING, singular: "pendiente", plural: "pendientes" },
  { field: "awaiting_payment", status: ORDER_STATUS.AWAITING_PAYMENT, singular: "por cobrar", plural: "por cobrar" },
];

export function getNextStatus(status) {
  return NEXT_STATUS[status] ?? null;
}

export function getAdvancePermission(status) {
  const nextStatus = getNextStatus(status);
  return nextStatus ? ADVANCE_PERMISSIONS[nextStatus] : null;
}

export function canAdvanceOrder(order, user) {
  const permission = getAdvancePermission(order.status);
  return Boolean(permission) && hasPermission(user, permission);
}

export function getBulkAdvanceLabel(orders) {
  const nextStatuses = new Set(orders.map((order) => getNextStatus(order.status)));
  if (nextStatuses.size !== 1) return DEFAULT_BULK_ADVANCE_LABEL;
  const [nextStatus] = nextStatuses;
  return BULK_ADVANCE_LABELS[nextStatus] ?? DEFAULT_BULK_ADVANCE_LABEL;
}

export function isOpenStatus(status) {
  return OPEN_ORDER_STATUSES.includes(status);
}

export function getWaitingMinutes(createdAt, now) {
  return Math.floor((now - new Date(createdAt).getTime()) / MILLISECONDS_PER_MINUTE);
}

export function formatWaitingTime(totalMinutes) {
  const minutes = Math.max(totalMinutes, 0);
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const remainingMinutes = minutes % MINUTES_PER_HOUR;
    return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
  }
  return `${Math.floor(minutes / MINUTES_PER_DAY)} d`;
}

export function isLate(createdAt, now, limitMinutes = KITCHEN_LATE_MINUTES) {
  return getWaitingMinutes(createdAt, now) >= limitMinutes;
}

const TIMED_STATUSES = [ORDER_STATUS.PENDING, ORDER_STATUS.PREPARING];

/** When the order reached the kitchen; prepaid orders only arrive once they are paid. */
export function kitchenSince(order) {
  return order.kitchen_at ?? order.created_at;
}

/**
 * Waiting time, estimate and delay of a kitchen card. The estimate only applies while the
 * kitchen is working on the order; "Listo" and orders without a time keep the fixed limit.
 */
export function kitchenTiming(order, now) {
  const waiting = getWaitingMinutes(kitchenSince(order), now);
  const estimate = TIMED_STATUSES.includes(order.status) && order.preparation_minutes > 0 ? order.preparation_minutes : null;
  if (estimate === null) return { waiting, estimate, overdue: 0, late: waiting >= KITCHEN_LATE_MINUTES };
  const overdue = Math.max(waiting - estimate, 0);
  return { waiting, estimate, overdue, late: overdue > 0 };
}

export function getTableState({
  pending,
  preparing,
  ready,
  awaiting_payment: awaitingPayment,
  bill_requested: billRequested,
  waiter_called: waiterCalled,
}) {
  if (billRequested) return TABLE_STATE.BILL;
  if (waiterCalled) return TABLE_STATE.WAITER;
  if (ready > 0) return TABLE_STATE.READY;
  if (preparing > 0) return TABLE_STATE.PREPARING;
  if (pending > 0) return TABLE_STATE.PENDING;
  if (awaitingPayment > 0) return TABLE_STATE.AWAITING_PAYMENT;
  return TABLE_STATE.FREE;
}

export function getTableSummaryLabels(table) {
  return TABLE_SUMMARY_COUNTERS.filter(({ field }) => table[field] > 0).map(({ field, status, singular, plural }) => ({
    status,
    color: ORDER_STATUS_COLORS[status],
    text: `${table[field]} ${table[field] === 1 ? singular : plural}`,
  }));
}
