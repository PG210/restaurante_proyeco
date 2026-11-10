import React, { useEffect, useState } from "react";
import { Button, Loader, Message, Table } from "semantic-ui-react";
import { productApi } from "../../../api/product";
import { EMPTY_VALUE } from "../../../utils/constants";
import { formatDateTime } from "../../../utils/dateRange";
import { notifyError } from "../../../utils/notify";

export function formatChange(change) {
  return change > 0 ? `+${change}` : String(change);
}

export function StockHistory({ product }) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    let active = true;
    productApi
      .stockMovements(product.id, page)
      .then((result) => active && setHistory(result))
      .catch((error) => {
        notifyError(error);
        if (active) setHistory({ count: 0, results: [], next: null, previous: null });
      });
    return () => {
      active = false;
    };
  }, [product.id, page]);

  if (history === null) {
    return (
      <Loader active inline="centered">
        Cargando...
      </Loader>
    );
  }
  if (!history.results.length) return <Message info size="small" content="Todavía no hay movimientos." />;

  return (
    <>
      <Table compact unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Fecha</Table.HeaderCell>
            <Table.HeaderCell>Motivo</Table.HeaderCell>
            <Table.HeaderCell>Cambio</Table.HeaderCell>
            <Table.HeaderCell>Quedan</Table.HeaderCell>
            <Table.HeaderCell>Por</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {history.results.map((movement) => (
            <Table.Row key={movement.id} positive={movement.change > 0} negative={movement.change < 0}>
              <Table.Cell>{formatDateTime(movement.created_at)}</Table.Cell>
              <Table.Cell>
                {movement.reason_label}
                {movement.note && ` — ${movement.note}`}
              </Table.Cell>
              <Table.Cell>{formatChange(movement.change)}</Table.Cell>
              <Table.Cell>{movement.stock_after ?? EMPTY_VALUE}</Table.Cell>
              <Table.Cell>{movement.created_by_name || EMPTY_VALUE}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Button basic disabled={!history.previous} onClick={() => setPage(page - 1)}>
        Más recientes
      </Button>
      <Button basic disabled={!history.next} onClick={() => setPage(page + 1)}>
        Más antiguos
      </Button>
    </>
  );
}
