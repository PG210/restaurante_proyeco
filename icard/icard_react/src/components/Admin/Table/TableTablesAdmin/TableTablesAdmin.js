import React from "react";
import { Button, Icon, Table } from "semantic-ui-react";
import "./TableTablesAdmin.scss";

export function TableTablesAdmin({ tables, updateTable, onDeleteTable }) {
  return (
    <Table className="table-tables-admin">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Mesa Número</Table.HeaderCell>
          <Table.HeaderCell></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {(tables || []).map((table) => (
          <Table.Row key={table.id}>
            <Table.Cell>{table.number}</Table.Cell>
            <Actions table={table} updateTable={updateTable} onDeleteTable={onDeleteTable} />
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Actions({ table, updateTable, onDeleteTable }) {
  return (
    <Table.Cell textAlign="right">
      <Button icon primary onClick={() => updateTable(table)}>
        <Icon name="pencil" />
      </Button>
      <Button icon color="red" onClick={() => onDeleteTable(table)}>
        <Icon name="close" />
      </Button>
    </Table.Cell>
  );
}
