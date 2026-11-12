import React from "react";
import { Message, Table } from "semantic-ui-react";
import { formatMoney } from "../../../utils/money";
import { CURRENT_NAMES_NOTE, EMPTY_REPORT_MESSAGE, maxAmount } from "../../../utils/salesReports";
import { BarCell } from "./BarCell";
import { ReportNote } from "./ReportNote";

export function CategoriesReport({ data }) {
  if (!data.categories.length) return <Message info content={EMPTY_REPORT_MESSAGE} />;
  const max = maxAmount(data.categories);

  return (
    <>
      <ReportNote>{CURRENT_NAMES_NOTE}</ReportNote>
      <Table compact celled aria-label="Consumo por categoría">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Categoría</Table.HeaderCell>
            <Table.HeaderCell>Unidades</Table.HeaderCell>
            <Table.HeaderCell>Consumo</Table.HeaderCell>
            <Table.HeaderCell>% del total</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {data.categories.map((row) => (
            <Table.Row key={`${row.category_id}-${row.name}`}>
              <Table.Cell>{row.name}</Table.Cell>
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
        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan={2}>Total</Table.HeaderCell>
            <Table.HeaderCell colSpan={2}>{formatMoney(data.total)}</Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </>
  );
}
