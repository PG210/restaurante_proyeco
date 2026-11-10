import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { HeaderPage, KitchenBoard } from "../../components/Admin";
import { useAuth, useOrder, usePolling } from "../../hooks";
import { KITCHEN_POLL_MS } from "../../utils/constants";
import { notifyError } from "../../utils/notify";
import { KITCHEN_STATUSES } from "../../utils/orderStatus";

const KITCHEN_FILTERS = {
  close: false,
  status__in: KITCHEN_STATUSES.join(","),
  ordering: "created_at",
};

export function KitchenAdmin() {
  const { auth } = useAuth();
  const { orders, getOrders, advanceOrder } = useOrder();

  const loadOrders = useCallback(() => getOrders(KITCHEN_FILTERS).catch(notifyError), [getOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  usePolling(loadOrders, KITCHEN_POLL_MS);

  const onAdvance = async (order) => {
    try {
      await advanceOrder(order.id);
      loadOrders();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <HeaderPage title="Cocina" />
      {orders === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <KitchenBoard orders={orders} user={auth.me} now={Date.now()} onAdvance={onAdvance} />
      )}
    </>
  );
}
