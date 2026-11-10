import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Icon, Loader } from "semantic-ui-react";
import { tableApi } from "../../api/table";
import { AddOrderForm, CancelOrderForm, HeaderPage, OrdersTable, TableControls } from "../../components/Admin";
import { ModalBasic } from "../../components/Common";
import { useAuth, useFormModal, useOrder, usePolling } from "../../hooks";
import { ADMIN_HOME_PATH } from "../../utils/adminSections";
import { ORDERS_POLL_MS } from "../../utils/constants";
import { notifyError } from "../../utils/notify";
import { OPEN_ORDER_STATUSES } from "../../utils/orderStatus";
import { PERMISSIONS, hasPermission } from "../../utils/permissions";
import { closeTableConfirmation } from "../../utils/tableStatus";

export function TableDetailsAdmin() {
  const { id: tableId } = useParams();
  const { auth } = useAuth();
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { orders, getOrders, advanceOrder, advanceOrders } = useOrder();
  const [table, setTable] = useState(null);
  const [tableBusy, setTableBusy] = useState(false);

  const loadOrders = useCallback(
    () =>
      getOrders({
        table: tableId,
        close: false,
        status__in: OPEN_ORDER_STATUSES.join(","),
        ordering: "created_at",
      }).catch(notifyError),
    [getOrders, tableId],
  );

  const loadTable = useCallback(() => tableApi.retrieve(tableId).then(setTable).catch(notifyError), [tableId]);

  const refresh = useCallback(() => {
    loadTable();
    loadOrders();
  }, [loadTable, loadOrders]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  usePolling(refresh, ORDERS_POLL_MS);

  const runTableAction = async (action) => {
    setTableBusy(true);
    try {
      setTable(await action(tableId));
    } catch (error) {
      notifyError(error);
    } finally {
      setTableBusy(false);
    }
  };

  const onCloseTable = () => {
    if (!window.confirm(closeTableConfirmation(table))) return;
    runTableAction(tableApi.close);
  };

  const onAddOrder = () => {
    openModal(
      `Nuevo pedido — Mesa ${table?.number ?? ""}`,
      <AddOrderForm tableId={Number(tableId)} onClose={closeModal} onRefetch={loadOrders} />,
    );
  };

  const onAdvance = async (order) => {
    try {
      await advanceOrder(order.id);
      loadOrders();
    } catch (error) {
      notifyError(error);
    }
  };

  const onBulkAdvance = async (orderIds) => {
    try {
      await advanceOrders(orderIds);
      loadOrders();
      return true;
    } catch (error) {
      notifyError(error);
      return false;
    }
  };

  const onCancel = (order) => {
    openModal(
      `Cancelar ${order.product_data?.title ?? "pedido"}`,
      <CancelOrderForm order={order} onClose={closeModal} onRefetch={loadOrders} />,
    );
  };

  const canAddOrders = hasPermission(auth.me, PERMISSIONS.ADD_ORDER);

  return (
    <>
      <Button as={Link} to={ADMIN_HOME_PATH} basic size="small">
        <Icon name="arrow left" /> Volver a las mesas
      </Button>

      <HeaderPage
        title={table ? `Mesa ${table.number}` : "Mesa"}
        btnTitle={canAddOrders ? "Añadir pedido" : undefined}
        btnClick={onAddOrder}
      />

      {table && (
        <TableControls
          table={table}
          user={auth.me}
          busy={tableBusy}
          onOpen={() => runTableAction(tableApi.open)}
          onClose={onCloseTable}
          onAttendBill={() => runTableAction(tableApi.attendBill)}
        />
      )}

      {orders === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <OrdersTable
          orders={orders}
          user={auth.me}
          onAdvance={onAdvance}
          onBulkAdvance={onBulkAdvance}
          onCancel={onCancel}
        />
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
