export const NOTIFICATION_TYPE = {
  BILL: "bill",
  ORDER: "order",
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

export function buildNotifications(guestOrders, tablesSummary, lastSeen) {
  return [...billNotifications(tablesSummary), ...orderNotifications(guestOrders, lastSeen)];
}

export function hasOrderNotifications(notifications) {
  return notifications.some((notification) => notification.type === NOTIFICATION_TYPE.ORDER);
}
