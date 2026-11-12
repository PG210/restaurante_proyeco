import React from "react";
import { Header, Message, Table } from "semantic-ui-react";
import { formatMoney } from "../../../utils/money";
import { EMPTY_REPORT_MESSAGE, STAFF_NOTE, maxAmount } from "../../../utils/salesReports";
import { BarCell } from "./BarCell";
import { ReportNote } from "./ReportNote";

export function StaffReport({ data }) {
  return (
    <>
      <ReportNote>{STAFF_NOTE}</ReportNote>
      <Header as="h4">Pedidos cargados por</Header>
      {data.staff.length ? <PlacedBy rows={data.staff} /> : <Message info content={EMPTY_REPORT_MESSAGE} />}
      <Header as="h4">Propinas por quien cobró</Header>
      {data.tips.length ? <Tips rows={data.tips} /> : <Message info content="Sin cobros en estas fechas." />}
    </>
  );
}

function PlacedBy({ rows }) {
  const max = maxAmount(rows);
  return (
    <Table compact celled aria-label="Pedidos cargados por">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Persona</Table.HeaderCell>
          <Table.HeaderCell>Consumo</Table.HeaderCell>
          <Table.HeaderCell>% del total</Table.HeaderCell>
          <Table.HeaderCell>Líneas</Table.HeaderCell>
          <Table.HeaderCell>Cuentas</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.user_id ?? "menu"}>
            <Table.Cell>{row.name}</Table.Cell>
            <Table.Cell>
              <BarCell value={row.amount} max={max}>
                {formatMoney(row.amount)}
              </BarCell>
            </Table.Cell>
            <Table.Cell>{row.share} %</Table.Cell>
            <Table.Cell>{row.lines}</Table.Cell>
            <Table.Cell>{row.bills}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Tips({ rows }) {
  return (
    <Table compact celled aria-label="Propinas por quien cobró">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Persona</Table.HeaderCell>
          <Table.HeaderCell>Cobros</Table.HeaderCell>
          <Table.HeaderCell>Propinas</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.user_id ?? "none"}>
            <Table.Cell>{row.name}</Table.Cell>
            <Table.Cell>{row.payments}</Table.Cell>
            <Table.Cell>{formatMoney(row.tips)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
