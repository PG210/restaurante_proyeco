import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { HeaderPage, KitchenBoard } from "../../components/Admin";
import { useAuth, useOrder, usePolling, useSoundAlerts } from "../../hooks";
import { KITCHEN_POLL_MS } from "../../utils/constants";
import { notifyError } from "../../utils/notify";
import { KITCHEN_STATUSES, ORDER_STATUS } from "../../utils/orderStatus";
import { CHIME } from "../../utils/sound";

const KITCHEN_FILTERS = {
  close: false,
  status__in: KITCHEN_STATUSES.join(","),
  ordering: "created_at",
};

/** Orders waiting in "Pendientes": a new id there is a new order for the kitchen. */
export function kitchenAlertKeys(orders) {
  return orders.filter((order) => order.status === ORDER_STATUS.PENDING).map((order) => String(order.id));
}

export function KitchenAdmin() {
  const { auth } = useAuth();
  const { orders, getOrders, advanceOrder } = useOrder();

  const loadOrders = useCallback(() => getOrders(KITCHEN_FILTERS).catch(notifyError), [getOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  usePolling(loadOrders, KITCHEN_POLL_MS);
  useSoundAlerts(orders === null ? null : kitchenAlertKeys(orders), CHIME.KITCHEN);

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
