import React, { useState } from "react";
import { Grid, Header, Message, Segment, Statistic, Table } from "semantic-ui-react";
import { formatMoney } from "../../../utils/money";
import { CURRENT_NAMES_NOTE, EMPTY_REPORT_MESSAGE, maxAmount, sortRows } from "../../../utils/salesReports";
import { BarCell } from "./BarCell";
import { ReportNote } from "./ReportNote";

const COLUMNS = [
  { key: "name", label: "Producto", sortable: true },
  { key: "category", label: "Categoría", sortable: false },
  { key: "units", label: "Unidades", sortable: true },
  { key: "amount", label: "Consumo", sortable: true },
  { key: "share", label: "% del total", sortable: false },
];

export function ProductsReport({ data }) {
  return (
    <>
      <Segment>
        <Statistic.Group size="mini" widths={2}>
          <Statistic label="Consumo" value={formatMoney(data.total)} />
          <Statistic label="Unidades" value={data.units} />
        </Statistic.Group>
      </Segment>
      <Grid stackable columns={2}>
        <Grid.Column>
          <Ranking title="Más vendidos" rows={data.top} empty="Ningún producto vendido." />
        </Grid.Column>
        <Grid.Column>
          <Ranking title="Menos vendidos" rows={data.bottom} empty="No hay productos activos." />
        </Grid.Column>
      </Grid>
      <Header as="h4">Todos los productos</Header>
      <ReportNote>{CURRENT_NAMES_NOTE}</ReportNote>
      {data.products.length ? <ProductsTable rows={data.products} /> : <Message info content={EMPTY_REPORT_MESSAGE} />}
    </>
  );
}

function Ranking({ title, rows, empty }) {
  return (
    <Table compact unstackable aria-label={title}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>{title}</Table.HeaderCell>
          <Table.HeaderCell textAlign="right">Unidades</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.length ? (
          rows.map((row) => (
            <Table.Row key={row.product_id}>
              <Table.Cell>{row.name}</Table.Cell>
              <Table.Cell textAlign="right">{row.units}</Table.Cell>
            </Table.Row>
          ))
        ) : (
          <Table.Row>
            <Table.Cell colSpan={2}>{empty}</Table.Cell>
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
}

function nextSort(current, column) {
  const sameColumnDescending = current.column === column && current.direction === "descending";
  return { column, direction: sameColumnDescending ? "ascending" : "descending" };
}

function ProductsTable({ rows }) {
  const [sort, setSort] = useState({ column: "amount", direction: "descending" });
  const sorted = sortRows(rows, sort.column, sort.direction);
  const max = maxAmount(rows);

  return (
    <Table sortable compact celled aria-label="Todos los productos">
      <Table.Header>
        <Table.Row>
          {COLUMNS.map((column) => (
            <Table.HeaderCell
              key={column.key}
              sorted={sort.column === column.key ? sort.direction : null}
              onClick={column.sortable ? () => setSort((current) => nextSort(current, column.key)) : undefined}
            >
              {column.label}
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {sorted.map((row) => (
          <Table.Row key={row.product_id ?? "deleted"}>
            <Table.Cell>{row.name}</Table.Cell>
            <Table.Cell>{row.category}</Table.Cell>
            <Table.Cell>{row.units}</Table.Cell>
            <Table.Cell>
              <BarCell value={row.amount} max={max}>
                {formatMoney(row.amount)}
              </BarCell>
            </Table.Cell>
            <Table.Cell>{row.share} %</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
