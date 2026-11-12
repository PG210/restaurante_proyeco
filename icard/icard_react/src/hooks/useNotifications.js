import { useCallback, useEffect, useState } from "react";
import { getTablesSummaryApi, orderApi } from "../api/order";
import { productApi } from "../api/product";
import { AVAILABILITY_PATH } from "../utils/adminSections";
import { ORDERS_POLL_MS } from "../utils/constants";
import { buildNotifications, latestCreatedAt, notificationsStorageKey } from "../utils/notifications";
import { notifyError } from "../utils/notify";
import { PERMISSIONS, hasPermission } from "../utils/permissions";
import { readJson, writeJson } from "../utils/storage";
import { usePolling } from "./usePolling";

const LOW_STOCK_FILTER = { low_stock: true, active: true };

export function useNotifications(user) {
  const enabled = hasPermission(user, PERMISSIONS.VIEW_ORDER);
  const watchesStock = hasPermission(user, PERMISSIONS.MANAGE_STOCK);
  const storageKey = notificationsStorageKey(user?.id);
  const [lastSeen, setLastSeen] = useState(() => readJson(storageKey, null) ?? new Date().toISOString());
  const [guestOrders, setGuestOrders] = useState([]);
  const [tablesSummary, setTablesSummary] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    writeJson(storageKey, lastSeen);
  }, [storageKey, lastSeen]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [orders, summary, lowStock] = await Promise.all([
        orderApi.list({ created_by__isnull: true, created_at_after: lastSeen, ordering: "-created_at" }),
        getTablesSummaryApi(),
        watchesStock ? productApi.list(LOW_STOCK_FILTER) : [],
      ]);
      setGuestOrders(orders);
      setTablesSummary(summary);
      setLowStockProducts(lowStock);
      setLoaded(true);
    } catch (error) {
      notifyError(error);
    }
  }, [enabled, watchesStock, lastSeen]);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, ORDERS_POLL_MS, enabled);

  const markOrdersAsRead = useCallback(() => {
    const latest = latestCreatedAt(guestOrders);
    if (!latest) return;
    setLastSeen(latest);
    setGuestOrders([]);
  }, [guestOrders]);

  return {
    enabled,
    loaded,
    notifications: buildNotifications(guestOrders, tablesSummary, lastSeen, {
      includePayments: hasPermission(user, PERMISSIONS.CHARGE_BILL),
      lowStockProducts,
      stockPath: AVAILABILITY_PATH,
    }),
    markOrdersAsRead,
  };
}
