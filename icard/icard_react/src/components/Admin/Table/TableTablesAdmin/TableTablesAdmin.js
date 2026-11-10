import React from "react";
import { Button, Icon, Label, Table } from "semantic-ui-react";
import "./TableTablesAdmin.scss";

export function TableTablesAdmin({ tables, updateTable, onDeleteTable, onShowQr }) {
  return (
    <Table className="table-tables-admin">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Mesa Número</Table.HeaderCell>
          <Table.HeaderCell>Estado</Table.HeaderCell>
          <Table.HeaderCell></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {(tables || []).map((table) => (
          <Table.Row key={table.id}>
            <Table.Cell>{table.number}</Table.Cell>
            <Table.Cell>
              <Label size="small" color={table.is_open ? "green" : "grey"} basic={!table.is_open}>
                {table.is_open ? "Abierta" : "Cerrada"}
              </Label>
            </Table.Cell>
            <Actions table={table} updateTable={updateTable} onDeleteTable={onDeleteTable} onShowQr={onShowQr} />
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Actions({ table, updateTable, onDeleteTable, onShowQr }) {
  return (
    <Table.Cell textAlign="right">
      <Button icon basic aria-label={`QR de la mesa ${table.number}`} onClick={() => onShowQr(table)}>
        <Icon name="qrcode" />
      </Button>
      <Button icon primary onClick={() => updateTable(table)}>
        <Icon name="pencil" />
      </Button>
      <Button icon color="red" onClick={() => onDeleteTable(table)}>
        <Icon name="close" />
      </Button>
    </Table.Cell>
  );
}
