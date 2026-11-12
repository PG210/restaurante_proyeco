import { formatWaitingTime, getWaitingMinutes } from "./orderStatus";

export const NOTIFICATION_TYPE = {
  BILL: "bill",
  WAITER: "waiter",
  PAYMENT: "payment",
  ORDER: "order",
  STOCK: "stock",
};

export function notificationsStorageKey(userId) {
  return `icard-notifications-seen-${userId}`;
}

export function isAfter(createdAt, lastSeen) {
  return new Date(createdAt).getTime() > new Date(lastSeen).getTime();
}

export function latestCreatedAt(orders) {
  return (orders || []).reduce(
    (latest, order) => (!latest || isAfter(order.created_at, latest) ? order.created_at : latest),
    null,
  );
}

function pluralizeProducts(count) {
  return `${count} ${count === 1 ? "producto" : "productos"}`;
}

function billNotifications(tablesSummary) {
  return (tablesSummary || [])
    .filter((table) => table.bill_requested)
    .map((table) => ({
      key: `bill-${table.id}`,
      type: NOTIFICATION_TYPE.BILL,
      tableId: table.id,
      tableNumber: table.number,
      text: `Mesa ${table.number} pide la cuenta`,
    }));
}

function waiterNotifications(tablesSummary, now) {
  return (tablesSummary || [])
    .filter((table) => table.waiter_called)
    .map((table) => ({
      key: `waiter-${table.id}`,
      type: NOTIFICATION_TYPE.WAITER,
      tableId: table.id,
      tableNumber: table.number,
      createdAt: table.waiter_called_at,
      text: `Mesa ${table.number} llama al mesero (hace ${formatWaitingTime(getWaitingMinutes(table.waiter_called_at, now))})`,
    }));
}

function paymentNotifications(tablesSummary) {
  return (tablesSummary || [])
    .filter((table) => table.awaiting_payment > 0)
    .map((table) => ({
      key: `payment-${table.id}`,
      type: NOTIFICATION_TYPE.PAYMENT,
      tableId: table.id,
      tableNumber: table.number,
      text: `Mesa ${table.number} tiene ${table.awaiting_payment} ${table.awaiting_payment === 1 ? "pedido" : "pedidos"} por cobrar`,
    }));
}

function groupOrdersByTable(orders) {
  return orders.reduce((groups, order) => {
    const current = groups.get(order.table) ?? {
      tableId: order.table,
      tableNumber: order.table_data?.number,
      productCount: 0,
      latestAt: order.created_at,
    };
    groups.set(order.table, {
      ...current,
      productCount: current.productCount + order.quantity,
      latestAt: isAfter(order.created_at, current.latestAt) ? order.created_at : current.latestAt,
    });
    return groups;
  }, new Map());
}

function orderNotifications(guestOrders, lastSeen) {
  const unseenOrders = (guestOrders || []).filter((order) => order.table && isAfter(order.created_at, lastSeen));
  return [...groupOrdersByTable(unseenOrders).values()]
    .sort((first, second) => new Date(second.latestAt) - new Date(first.latestAt))
    .map((group) => ({
      key: `order-${group.tableId}`,
      type: NOTIFICATION_TYPE.ORDER,
      tableId: group.tableId,
      tableNumber: group.tableNumber,
      createdAt: group.latestAt,
      text: `Mesa ${group.tableNumber} hizo un pedido (${pluralizeProducts(group.productCount)})`,
    }));
}

function stockNotifications(lowStockProducts, path) {
  return (lowStockProducts || []).map((product) => ({
    key: `stock-${product.id}`,
    type: NOTIFICATION_TYPE.STOCK,
    path,
    text: `Quedan ${product.stock} de ${product.title}`,
  }));
}

export function buildNotifications(
  guestOrders,
  tablesSummary,
  lastSeen,
  { includePayments = false, lowStockProducts = [], stockPath = null, now = Date.now() } = {},
) {
  return [
    ...waiterNotifications(tablesSummary, now),
    ...billNotifications(tablesSummary),
    ...(includePayments ? paymentNotifications(tablesSummary) : []),
    ...orderNotifications(guestOrders, lastSeen),
    ...stockNotifications(lowStockProducts, stockPath),
  ];
}

export function hasOrderNotifications(notifications) {
  return notifications.some((notification) => notification.type === NOTIFICATION_TYPE.ORDER);
}

/** Notifications that ring: something a guest did. Stock and pending payments only show in the bell. */
const ALERT_TYPES = [NOTIFICATION_TYPE.WAITER, NOTIFICATION_TYPE.BILL, NOTIFICATION_TYPE.ORDER];

/**
 * One key per guest event. The time is part of the key so a new order from a table that
 * already had an unread one, or a second call after the first was attended, rings again.
 */
export function alertKeys(notifications) {
  return notifications
    .filter((notification) => ALERT_TYPES.includes(notification.type))
    .map((notification) => `${notification.key}@${notification.createdAt ?? ""}`);
}
