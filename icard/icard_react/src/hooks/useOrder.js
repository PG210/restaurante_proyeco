import { useCallback, useState } from "react";
import { getTablesSummaryApi, orderApi } from "../api/order";
import { useRequestState } from "./useRequestState";

export function useOrder() {
  const { loading, error, run } = useRequestState();
  const [orders, setOrders] = useState(null);

  const getOrders = useCallback(
    (filters) =>
      run(async () => {
        const result = await orderApi.list(filters);
        setOrders(result);
        return result;
      }),
    [run],
  );

  const addOrders = useCallback((tableId, items) => run(() => orderApi.createBulk(tableId, items)), [run]);

  const advanceOrder = useCallback((id) => run(() => orderApi.advance(id)), [run]);

  const advanceOrders = useCallback((ids) => run(() => orderApi.bulkAdvance(ids)), [run]);

  const cancelOrder = useCallback((id, reason) => run(() => orderApi.cancel(id, reason)), [run]);

  return { loading, error, orders, getOrders, addOrders, advanceOrder, advanceOrders, cancelOrder };
}

export function useTablesSummary() {
  const { loading, error, run } = useRequestState();
  const [summary, setSummary] = useState(null);

  const getSummary = useCallback(
    () =>
      run(async () => {
        const result = await getTablesSummaryApi();
        setSummary(result);
        return result;
      }),
    [run],
  );

  return { loading, error, summary, getSummary };
}
