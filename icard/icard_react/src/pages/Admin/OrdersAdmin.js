import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "semantic-ui-react";
import { HeaderPage, TableListAdmin } from "../../components/Admin";
import { usePolling, useTablesSummary } from "../../hooks";
import { tableDetailPath } from "../../utils/adminSections";
import { ORDERS_POLL_MS } from "../../utils/constants";
import { notifyError } from "../../utils/notify";

export function OrdersAdmin() {
  const navigate = useNavigate();
  const [autoReload, setAutoReload] = useState(false);
  const { summary, getSummary } = useTablesSummary();

  const loadSummary = useCallback(() => getSummary().catch(notifyError), [getSummary]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  usePolling(loadSummary, ORDERS_POLL_MS, autoReload);

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
        />
      )}
    </>
  );
}
