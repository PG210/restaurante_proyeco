import React, { useState } from "react";
import { Button, Checkbox, Label, Message, Table } from "semantic-ui-react";
import "./OrdersTable.scss";
import { useSelection } from "../../../../hooks/useSelection";
import { EMPTY_VALUE } from "../../../../utils/constants";
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  canAdvanceOrder,
  getBulkAdvanceLabel,
} from "../../../../utils/orderStatus";
import { OrderActions } from "../OrderActions/OrderActions";

const SELECT_ALL_ID = "orders-table-select-all";

export function OrdersTable({ orders, user, onAdvance, onBulkAdvance, onCancel }) {
  const selectableIds = (orders || []).filter((order) => canAdvanceOrder(order, user)).map((order) => order.id);
  const { selectedIds, allSelected, someSelected, toggle, toggleAll, clear } = useSelection(selectableIds);
  const [sending, setSending] = useState(false);

  if (!orders?.length) return <Message info content="La mesa no tiene pedidos abiertos." />;

  const selectedOrders = orders.filter((order) => selectedIds.includes(order.id));
  const hasSelectableOrders = selectableIds.length > 0;

  const advanceSelected = async () => {
    setSending(true);
    const advanced = await onBulkAdvance(selectedIds);
    setSending(false);
    if (advanced) clear();
  };

  return (
    <>
      {hasSelectableOrders && (
        <div className="orders-table__bulk">
          <Checkbox
            id={SELECT_ALL_ID}
            label="Seleccionar todos"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleAll}
          />
          <Button primary disabled={!selectedIds.length} loading={sending} onClick={advanceSelected}>
            {getBulkAdvanceLabel(selectedOrders)} ({selectedIds.length})
          </Button>
        </div>
      )}

      <Table>
        <Table.Header>
          <Table.Row>
            {hasSelectableOrders && <Table.HeaderCell collapsing />}
            <Table.HeaderCell>Producto</Table.HeaderCell>
            <Table.HeaderCell>Cantidad</Table.HeaderCell>
            <Table.HeaderCell>Notas</Table.HeaderCell>
            <Table.HeaderCell>Precio</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
            <Table.HeaderCell></Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {orders.map((order) => (
            <Table.Row key={order.id} active={selectedIds.includes(order.id)}>
              {hasSelectableOrders && (
                <Table.Cell collapsing>
                  {selectableIds.includes(order.id) && (
                    <Checkbox
                      aria-label={`Seleccionar ${order.product_data?.title ?? "pedido"}`}
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggle(order.id)}
                    />
                  )}
                </Table.Cell>
              )}
              <Table.Cell>{order.product_data?.title ?? EMPTY_VALUE}</Table.Cell>
              <Table.Cell>{order.quantity}</Table.Cell>
              <Table.Cell>{order.notes || EMPTY_VALUE}</Table.Cell>
              <Table.Cell>{order.price ? `$${order.price}` : EMPTY_VALUE}</Table.Cell>
              <Table.Cell>
                <Label color={ORDER_STATUS_COLORS[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Label>
              </Table.Cell>
              <Table.Cell textAlign="right">
                <OrderActions order={order} user={user} onAdvance={onAdvance} onCancel={onCancel} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </>
  );
}
