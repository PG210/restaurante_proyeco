import React from "react";
import { Button, Icon, Label, Table } from "semantic-ui-react";
import { formatPrice } from "../../../../utils/cart";
import { choicesHint } from "../../../../utils/modifiers";

export function optionLabel(option) {
  const price = Number(option.price_delta) > 0 ? ` (+${formatPrice(option.price_delta)})` : "";
  return `${option.name}${price}`;
}

export function TableModifierGroupAdmin({ groups, onEdit, onDelete }) {
  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Grupo</Table.HeaderCell>
          <Table.HeaderCell>Regla</Table.HeaderCell>
          <Table.HeaderCell>Opciones</Table.HeaderCell>
          <Table.HeaderCell>Productos</Table.HeaderCell>
          <Table.HeaderCell>Estado</Table.HeaderCell>
          <Table.HeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {groups.map((group) => (
          <Table.Row key={group.id}>
            <Table.Cell>{group.name}</Table.Cell>
            <Table.Cell>{choicesHint(group)}</Table.Cell>
            <Table.Cell>
              {group.modifiers.map((option) => (
                <Label key={option.id} size="small" basic={!option.active} color={option.active ? undefined : "grey"}>
                  {optionLabel(option)}
                </Label>
              ))}
            </Table.Cell>
            <Table.Cell>{group.product_count}</Table.Cell>
            <Table.Cell>
              <Label size="small" color={group.active ? "green" : "grey"} basic={!group.active}>
                {group.active ? "Activo" : "Inactivo"}
              </Label>
            </Table.Cell>
            <Table.Cell textAlign="right" collapsing>
              <Button icon aria-label={`Editar ${group.name}`} onClick={() => onEdit(group)}>
                <Icon name="pencil" />
              </Button>
              <Button icon negative aria-label={`Eliminar ${group.name}`} onClick={() => onDelete(group)}>
                <Icon name="close" />
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
