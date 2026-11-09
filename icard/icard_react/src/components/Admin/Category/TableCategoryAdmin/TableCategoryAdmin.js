import React from "react";
import { Button, Icon, Image, Table } from "semantic-ui-react";
import "./TableCategoryAdmin.scss";

export function TableCategoryAdmin({ categories, updateCategory, onDeleteCategory }) {
  return (
    <Table className="table-category-admin">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Imagen</Table.HeaderCell>
          <Table.HeaderCell>Categoria</Table.HeaderCell>
          <Table.HeaderCell></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {(categories || []).map((category) => (
          <Table.Row key={category.id}>
            <Table.Cell width={2}>
              <Image src={category.image} />
            </Table.Cell>
            <Table.Cell width={2}>{category.title}</Table.Cell>
            <Actions category={category} updateCategory={updateCategory} onDeleteCategory={onDeleteCategory} />
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Actions({ category, updateCategory, onDeleteCategory }) {
  return (
    <Table.Cell textAlign="right">
      <Button icon onClick={() => updateCategory(category)}>
        <Icon name="pencil" />
      </Button>
      <Button icon negative onClick={() => onDeleteCategory(category)}>
        <Icon name="close" />
      </Button>
    </Table.Cell>
  );
}
