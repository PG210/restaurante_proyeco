import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Button, Header, Item, Label, Loader, Message, Segment } from "semantic-ui-react";
import { customerApi } from "../../api/customer";
import { useCustomer } from "../../context/CustomerContext";
import { usePolling } from "../../hooks";
import { formatPrice } from "../../utils/cart";
import { CUSTOMER_POLL_MS, EMPTY_VALUE } from "../../utils/constants";
import { notifyError } from "../../utils/notify";
import { ORDER_STATUS, ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "../../utils/orderStatus";
import { PAYMENT_MODE } from "../../utils/tax";

export function customerOrdersTotal(orders) {
  return orders
    .filter((order) => order.status !== ORDER_STATUS.CANCELLED)
    .reduce((total, order) => total + Number(order.price ?? 0) * order.quantity, 0);
}

export function hasAwaitingPayment(orders) {
  return orders.some((order) => order.status === ORDER_STATUS.AWAITING_PAYMENT);
}

export function CustomerOrders() {
  const { token, table, setTable, isPaused, pauseOnThrottle } = useCustomer();
  const [orders, setOrders] = useState(null);
  const [requestingBill, setRequestingBill] = useState(false);

  const loadOrders = useCallback(async () => {
    if (isPaused()) return;
    try {
      setOrders(await customerApi.getOrders(token));
    } catch (error) {
      pauseOnThrottle(error);
      notifyError(error);
    }
  }, [token, isPaused, pauseOnThrottle]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  usePolling(loadOrders, CUSTOMER_POLL_MS);

  const requestBill = async () => {
    setRequestingBill(true);
    try {
      setTable(await customerApi.requestBill(token));
      toast.success("Avisamos al personal. En breve te traen la cuenta.");
    } catch (error) {
      pauseOnThrottle(error);
      notifyError(error);
    } finally {
      setRequestingBill(false);
    }
  };

  if (orders === null) {
    return (
      <Loader active inline="centered">
        Cargando pedidos...
      </Loader>
    );
  }

  return (
    <>
      <Header as="h2">Mis pedidos</Header>
      {table.payment_mode === PAYMENT_MODE.PREPAID && hasAwaitingPayment(orders) && (
        <Message warning content="Paga en caja para que preparemos tu pedido." />
      )}
      {orders.length ? <OrderList orders={orders} /> : <Message info content="Todavía no has pedido nada." />}

      <Segment clearing>
        <Header as="h3" floated="left">
          Total
        </Header>
        <Header as="h3" floated="right">
          {formatPrice(customerOrdersTotal(orders))}
        </Header>
      </Segment>

      {table.bill_requested ? (
        <Message positive content="Ya pediste la cuenta. El personal viene en camino." />
      ) : (
        <Button fluid size="large" color="green" loading={requestingBill} disabled={!orders.length || requestingBill} onClick={requestBill}>
          Pedir la cuenta
        </Button>
      )}
    </>
  );
}

function OrderList({ orders }) {
  return (
    <Item.Group divided unstackable>
      {orders.map((order) => (
        <Item key={order.id}>
          <Item.Content>
            <Item.Header>
              {order.quantity} × {order.product_title ?? EMPTY_VALUE}
            </Item.Header>
            <Item.Meta>{order.price ? formatPrice(Number(order.price) * order.quantity) : EMPTY_VALUE}</Item.Meta>
            {order.notes && <Item.Description>{order.notes}</Item.Description>}
            <Item.Extra>
              <Label color={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Label>
            </Item.Extra>
          </Item.Content>
        </Item>
      ))}
    </Item.Group>
  );
}
