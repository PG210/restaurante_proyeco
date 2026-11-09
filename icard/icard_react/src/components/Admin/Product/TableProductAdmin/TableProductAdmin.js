import React from "react";
import { Button, Icon, Image, Table } from "semantic-ui-react";
import "./TableProductAdmin.scss";
import { EMPTY_VALUE } from "../../../../utils/constants";

export function TableProductAdmin({ products, updateProduct, onDeleteProduct }) {
  return (
    <Table className="table-product-admin">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Imagen</Table.HeaderCell>
          <Table.HeaderCell>Producto</Table.HeaderCell>
          <Table.HeaderCell>Precio</Table.HeaderCell>
          <Table.HeaderCell>Categoria</Table.HeaderCell>
          <Table.HeaderCell>Activo</Table.HeaderCell>
          <Table.HeaderCell></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {(products || []).map((product) => (
          <Table.Row key={product.id}>
            <Table.Cell width={2}>
              <Image src={product.image} alt={product.title} />
            </Table.Cell>
            <Table.Cell>{product.title}</Table.Cell>
            <Table.Cell>${product.price}</Table.Cell>
            <Table.Cell>{product.category_data?.title ?? EMPTY_VALUE}</Table.Cell>
            <Table.Cell className="status">
              <Icon name={product.active ? "check" : "close"} />
            </Table.Cell>
            <Actions product={product} updateProduct={updateProduct} onDeleteProduct={onDeleteProduct} />
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Actions({ product, updateProduct, onDeleteProduct }) {
  return (
    <Table.Cell>
      <Button icon primary onClick={() => updateProduct(product)}>
        <Icon name="pencil" />
      </Button>
      <Button icon color="red" onClick={() => onDeleteProduct(product)}>
        <Icon name="close" />
      </Button>
    </Table.Cell>
  );
}
