import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "semantic-ui-react";
import { tableApi } from "../../api/table";
import { HeaderPage, TableListAdmin } from "../../components/Admin";
import { useAuth, usePolling, useTablesSummary } from "../../hooks";
import { tableDetailPath } from "../../utils/adminSections";
import { ORDERS_POLL_MS } from "../../utils/constants";
import { notifyError } from "../../utils/notify";
import { PERMISSIONS, hasPermission } from "../../utils/permissions";
import { closeTableConfirmation } from "../../utils/tableStatus";

export function OrdersAdmin() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [autoReload, setAutoReload] = useState(false);
  const [togglingTableId, setTogglingTableId] = useState(null);
  const { summary, getSummary } = useTablesSummary();

  const loadSummary = useCallback(() => getSummary().catch(notifyError), [getSummary]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  usePolling(loadSummary, ORDERS_POLL_MS, autoReload);

  const toggleOpen = async (table) => {
    if (table.is_open && !window.confirm(closeTableConfirmation(table))) return;
    setTogglingTableId(table.id);
    try {
      await (table.is_open ? tableApi.close : tableApi.open)(table.id);
      await loadSummary();
    } catch (error) {
      notifyError(error);
    } finally {
      setTogglingTableId(null);
    }
  };

  return (
    <>
      <HeaderPage title="Administración de Pedidos" />
      {summary === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <TableListAdmin
          tables={summary}
          onReload={loadSummary}
          autoReload={autoReload}
          onToggleAutoReload={setAutoReload}
          onSelectTable={(table) => navigate(tableDetailPath(table.id))}
          canToggleOpen={hasPermission(auth.me, PERMISSIONS.OPEN_TABLE)}
          togglingTableId={togglingTableId}
          onToggleOpen={toggleOpen}
        />
      )}
    </>
  );
}
