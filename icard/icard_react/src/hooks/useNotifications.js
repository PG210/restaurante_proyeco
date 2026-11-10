import { useCallback, useEffect, useState } from "react";
import { getTablesSummaryApi, orderApi } from "../api/order";
import { ORDERS_POLL_MS } from "../utils/constants";
import { buildNotifications, latestCreatedAt, notificationsStorageKey } from "../utils/notifications";
import { notifyError } from "../utils/notify";
import { PERMISSIONS, hasPermission } from "../utils/permissions";
import { readJson, writeJson } from "../utils/storage";
import { usePolling } from "./usePolling";

export function useNotifications(user) {
  const enabled = hasPermission(user, PERMISSIONS.VIEW_ORDER);
  const storageKey = notificationsStorageKey(user?.id);
  const [lastSeen, setLastSeen] = useState(() => readJson(storageKey, null) ?? new Date().toISOString());
  const [guestOrders, setGuestOrders] = useState([]);
  const [tablesSummary, setTablesSummary] = useState([]);

  useEffect(() => {
    writeJson(storageKey, lastSeen);
  }, [storageKey, lastSeen]);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [orders, summary] = await Promise.all([
        orderApi.list({ created_by__isnull: true, created_at_after: lastSeen, ordering: "-created_at" }),
        getTablesSummaryApi(),
      ]);
      setGuestOrders(orders);
      setTablesSummary(summary);
    } catch (error) {
      notifyError(error);
    }
  }, [enabled, lastSeen]);

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
    notifications: buildNotifications(guestOrders, tablesSummary, lastSeen, {
      includePayments: hasPermission(user, PERMISSIONS.CHARGE_BILL),
    }),
    markOrdersAsRead,
  };
}
