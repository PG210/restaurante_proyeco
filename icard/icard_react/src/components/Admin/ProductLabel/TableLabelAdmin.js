import React from "react";
import { Button, Icon, Label, Table } from "semantic-ui-react";

export function TableLabelAdmin({ labels, caption, onEdit, onDelete }) {
  return (
    <Table compact aria-label={caption}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Nombre</Table.HeaderCell>
          <Table.HeaderCell>Productos</Table.HeaderCell>
          <Table.HeaderCell>Estado</Table.HeaderCell>
          <Table.HeaderCell>Orden</Table.HeaderCell>
          <Table.HeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {labels.map((label) => (
          <Table.Row key={label.id}>
            <Table.Cell>{label.name}</Table.Cell>
            <Table.Cell>{label.product_count}</Table.Cell>
            <Table.Cell>
              <Label size="small" color={label.active ? "green" : "grey"} basic={!label.active}>
                {label.active ? "Activo" : "Inactivo"}
              </Label>
            </Table.Cell>
            <Table.Cell>{label.position}</Table.Cell>
            <Table.Cell textAlign="right" collapsing>
              <Button icon aria-label={`Editar ${label.name}`} onClick={() => onEdit(label)}>
                <Icon name="pencil" />
              </Button>
              <Button icon negative aria-label={`Eliminar ${label.name}`} onClick={() => onDelete(label)}>
                <Icon name="close" />
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
