import React from "react";
import { Grid, Header, Message, Segment, Statistic, Table } from "semantic-ui-react";
import { formatDateTime } from "../../../utils/dateRange";
import { formatMoney } from "../../../utils/money";
import { CANCELLATIONS_NOTE } from "../../../utils/salesReports";
import { ReportNote } from "./ReportNote";

export const NO_CANCELLATIONS_MESSAGE = "Sin pedidos cancelados en estas fechas.";

export function CancellationsReport({ data }) {
  if (!data.count) return <Message info content={NO_CANCELLATIONS_MESSAGE} />;

  return (
    <>
      <ReportNote>{CANCELLATIONS_NOTE}</ReportNote>
      <Segment>
        <Statistic.Group size="mini" widths={3}>
          <Statistic label="Cancelaciones" value={data.count} />
          <Statistic label="Unidades" value={data.units} />
          <Statistic label="Valor" value={formatMoney(data.amount)} />
        </Statistic.Group>
      </Segment>
      <Grid stackable columns={2}>
        <Grid.Column>
          <Summary title="Por motivo" firstColumn="Motivo" rows={data.by_reason} nameOf={(row) => row.reason} />
        </Grid.Column>
        <Grid.Column>
          <Summary title="Por producto" firstColumn="Producto" rows={data.by_product} nameOf={(row) => row.name} />
        </Grid.Column>
      </Grid>
      <Header as="h4">Últimas cancelaciones</Header>
      <Latest rows={data.latest} />
    </>
  );
}

function Summary({ title, firstColumn, rows, nameOf }) {
  return (
    <Table compact celled unstackable aria-label={title}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>{firstColumn}</Table.HeaderCell>
          <Table.HeaderCell>Veces</Table.HeaderCell>
          <Table.HeaderCell>Valor</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={nameOf(row)}>
            <Table.Cell>{nameOf(row)}</Table.Cell>
            <Table.Cell>{row.count}</Table.Cell>
            <Table.Cell>{formatMoney(row.amount)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Latest({ rows }) {
  return (
    <Table compact celled aria-label="Últimas cancelaciones">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Pedido</Table.HeaderCell>
          <Table.HeaderCell>Mesa</Table.HeaderCell>
          <Table.HeaderCell>Producto</Table.HeaderCell>
          <Table.HeaderCell>Valor</Table.HeaderCell>
          <Table.HeaderCell>Motivo</Table.HeaderCell>
          <Table.HeaderCell>Cargado por</Table.HeaderCell>
          <Table.HeaderCell>Cancelado</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.id}>
            <Table.Cell>{formatDateTime(row.created_at)}</Table.Cell>
            <Table.Cell>{row.table_number ?? "—"}</Table.Cell>
            <Table.Cell>
              {row.quantity} × {row.product}
            </Table.Cell>
            <Table.Cell>{formatMoney(row.amount)}</Table.Cell>
            <Table.Cell>{row.reason}</Table.Cell>
            <Table.Cell>{row.placed_by}</Table.Cell>
            <Table.Cell>{row.cancelled_at ? `${formatDateTime(row.cancelled_at)} · ${row.cancelled_by ?? "—"}` : "—"}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
