import React from "react";
import { Button, Checkbox, Icon, Image, Label, Table } from "semantic-ui-react";
import "./TableProductAdmin.scss";
import { EMPTY_VALUE } from "../../../../utils/constants";
import { preparationCell } from "../../../../utils/preparation";

export function TableProductAdmin({ products, updateProduct, onDeleteProduct, onToggleAvailability, togglingId }) {
  return (
    <Table className="table-product-admin">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Imagen</Table.HeaderCell>
          <Table.HeaderCell>Producto</Table.HeaderCell>
          <Table.HeaderCell>Precio</Table.HeaderCell>
          <Table.HeaderCell>Categoria</Table.HeaderCell>
          <Table.HeaderCell>En la carta</Table.HeaderCell>
          <Table.HeaderCell>Disponible hoy</Table.HeaderCell>
          <Table.HeaderCell>Alérgenos</Table.HeaderCell>
          <Table.HeaderCell>Preparación</Table.HeaderCell>
          <Table.HeaderCell>Stock</Table.HeaderCell>
          <Table.HeaderCell>Vendidos hoy</Table.HeaderCell>
          <Table.HeaderCell>Orden</Table.HeaderCell>
          <Table.HeaderCell></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {(products || []).map((product) => (
          <Table.Row key={product.id} warning={product.low_stock}>
            <Table.Cell width={2}>
              <Image src={product.image} alt={product.title} />
            </Table.Cell>
            <Table.Cell>{product.title}</Table.Cell>
            <Table.Cell>${product.price}</Table.Cell>
            <Table.Cell>{product.category_data?.title ?? EMPTY_VALUE}</Table.Cell>
            <Table.Cell className="status">
              <Icon name={product.active ? "check" : "close"} />
            </Table.Cell>
            <Table.Cell>
              <Checkbox
                toggle
                aria-label={`Disponible hoy: ${product.title}`}
                checked={!product.sold_out_today}
                disabled={togglingId === product.id}
                onChange={(_, data) => onToggleAvailability(product, data.checked)}
              />
            </Table.Cell>
            <Table.Cell>{allergenCell(product)}</Table.Cell>
            <Table.Cell>{preparationCell(product.preparation_time)}</Table.Cell>
            <Table.Cell>{formatStock(product.stock)}</Table.Cell>
            <Table.Cell>{product.sold_today ?? EMPTY_VALUE}</Table.Cell>
            <Table.Cell>{product.position}</Table.Cell>
            <Actions product={product} updateProduct={updateProduct} onDeleteProduct={onDeleteProduct} />
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

export const UNREVIEWED_CELL = "Sin revisar";

export function allergenCell(product) {
  const names = (product.allergens ?? []).map((allergen) => allergen.name);
  if (names.length) return names.join(", ");
  return product.allergens_declared ? "Ninguno" : <Label size="small" color="orange" basic content={UNREVIEWED_CELL} />;
}

export function formatStock(stock) {
  return stock === null || stock === undefined ? "Sin control" : stock;
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
