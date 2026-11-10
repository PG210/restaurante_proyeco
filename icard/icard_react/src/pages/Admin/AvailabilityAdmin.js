import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button, Checkbox, Icon, Loader, Message, Table } from "semantic-ui-react";
import { productApi } from "../../api/product";
import { HeaderPage } from "../../components/Admin";
import { TableFilters } from "../../components/Common";
import { useAvailabilityToggle, useTableFilters } from "../../hooks";
import { AVAILABILITY_FILTERS, AVAILABLE_OPTIONS, productCategoryOptions } from "../../utils/catalogFilters";
import { EMPTY_VALUE } from "../../utils/constants";
import { notifyError } from "../../utils/notify";

export const RESTOCK_CONFIRMATION = "¿Volver a poner disponibles todos los productos agotados hoy?";

export function restockMessage(restocked) {
  if (restocked === 0) return "No había productos agotados.";
  return restocked === 1 ? "1 producto vuelve a estar disponible." : `${restocked} productos vuelven a estar disponibles.`;
}

export function AvailabilityAdmin() {
  const [products, setProducts] = useState(null);
  const [restocking, setRestocking] = useState(false);
  const availabilityFilters = useTableFilters(products, AVAILABILITY_FILTERS);

  const load = useCallback(async () => {
    try {
      setProducts(await productApi.list({ active: true }));
    } catch (error) {
      notifyError(error);
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceProduct = useCallback(
    (updated) => setProducts((current) => current.map((product) => (product.id === updated.id ? updated : product))),
    [],
  );
  const { togglingId, toggleAvailability } = useAvailabilityToggle(replaceProduct);

  const selects = useMemo(
    () => [
      { name: "category", label: "Categoría", options: productCategoryOptions(products) },
      { name: "available", label: "Disponibilidad", options: AVAILABLE_OPTIONS },
    ],
    [products],
  );

  const restock = async () => {
    if (!window.confirm(RESTOCK_CONFIRMATION)) return;
    setRestocking(true);
    try {
      const { restocked } = await productApi.restock();
      toast.success(restockMessage(restocked));
      await load();
    } catch (error) {
      notifyError(error);
    } finally {
      setRestocking(false);
    }
  };

  return (
    <>
      <HeaderPage title="Disponibilidad de productos" />
      <Message info size="small">
        Marca lo que se acabó: la carta lo muestra como agotado y no se puede pedir. Los productos agotados vuelven a
        estar disponibles solos al empezar el siguiente día de servicio (por defecto, a las 5:00 a. m.).
      </Message>

      <Button primary loading={restocking} disabled={restocking} onClick={restock}>
        <Icon name="redo" /> Reponer todo
      </Button>

      {products === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <>
          <TableFilters state={availabilityFilters} selects={selects} searchPlaceholder="Buscar producto" />
          <AvailabilityTable
            products={availabilityFilters.filtered}
            togglingId={togglingId}
            onToggle={toggleAvailability}
          />
        </>
      )}
    </>
  );
}

function AvailabilityTable({ products, togglingId, onToggle }) {
  return (
    <Table compact unstackable>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Producto</Table.HeaderCell>
          <Table.HeaderCell>Categoría</Table.HeaderCell>
          <Table.HeaderCell>Agotado hoy</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {products.map((product) => (
          <Table.Row key={product.id} negative={!product.is_available}>
            <Table.Cell>{product.title}</Table.Cell>
            <Table.Cell>{product.category_data?.title ?? EMPTY_VALUE}</Table.Cell>
            <Table.Cell>
              <Checkbox
                toggle
                aria-label={`Agotado hoy: ${product.title}`}
                checked={!product.is_available}
                disabled={togglingId === product.id}
                onChange={(_, data) => onToggle(product, !data.checked)}
              />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
