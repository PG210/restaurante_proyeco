import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button, Checkbox, Icon, Loader, Message, Table } from "semantic-ui-react";
import { productApi } from "../../api/product";
import { HeaderPage, STOCK_FORM_MODE, StockForm, StockHistory } from "../../components/Admin";
import { ModalBasic, TableFilters } from "../../components/Common";
import { useAuth, useAvailabilityToggle, useFormModal, useTableFilters } from "../../hooks";
import {
  AVAILABILITY_FILTERS,
  AVAILABLE_OPTIONS,
  LOW_STOCK_OPTIONS,
  productCategoryOptions,
} from "../../utils/catalogFilters";
import { EMPTY_VALUE } from "../../utils/constants";
import { notifyError } from "../../utils/notify";
import { PERMISSIONS, hasPermission } from "../../utils/permissions";
import { formatStock } from "../../components/Admin/Product/TableProductAdmin/TableProductAdmin";

export const RESTOCK_CONFIRMATION = "¿Quitar el \"Agotado hoy\" de todos los productos? No cambia el stock.";

export function restockMessage(restocked) {
  if (restocked === 0) return "No había productos agotados.";
  return restocked === 1 ? "1 producto vuelve a estar disponible." : `${restocked} productos vuelven a estar disponibles.`;
}

export function AvailabilityAdmin() {
  const { auth } = useAuth();
  const canToggle = hasPermission(auth?.me, PERMISSIONS.SET_PRODUCT_AVAILABILITY);
  const canManageStock = hasPermission(auth?.me, PERMISSIONS.MANAGE_STOCK);
  const [products, setProducts] = useState(null);
  const [restocking, setRestocking] = useState(false);
  const availabilityFilters = useTableFilters(products, AVAILABILITY_FILTERS);
  const { show, title, content, openModal, closeModal } = useFormModal();

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
      ...(canManageStock ? [{ name: "lowStock", label: "Stock", options: LOW_STOCK_OPTIONS }] : []),
    ],
    [products, canManageStock],
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

  const openStockForm = (product, mode) => {
    const formTitle = mode === STOCK_FORM_MODE.ADD ? "Sumar unidades" : "Ajustar stock";
    openModal(
      `${formTitle}: ${product.title}`,
      <StockForm product={product} mode={mode} onSaved={replaceProduct} onClose={closeModal} />,
    );
  };

  const openHistory = (product) => openModal(`Movimientos: ${product.title}`, <StockHistory product={product} />);

  return (
    <>
      <HeaderPage title="Disponibilidad y stock" />
      <Message info size="small">
        "Agotado hoy" vuelve solo al empezar el siguiente día de servicio (por defecto, a las 5:00 a. m.). Los productos
        con control de stock se agotan solos al llegar a 0 y vuelven al reponer unidades.
      </Message>

      {canToggle && (
        <Button primary loading={restocking} disabled={restocking} onClick={restock}>
          <Icon name="redo" /> Quitar todos los "Agotado hoy"
        </Button>
      )}

      {products === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <>
          <TableFilters state={availabilityFilters} selects={selects} searchPlaceholder="Buscar producto" />
          <AvailabilityTable
            products={availabilityFilters.filtered}
            canToggle={canToggle}
            canManageStock={canManageStock}
            togglingId={togglingId}
            onToggle={toggleAvailability}
            onStockForm={openStockForm}
            onHistory={openHistory}
          />
        </>
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}

function AvailabilityTable({ products, canToggle, canManageStock, togglingId, onToggle, onStockForm, onHistory }) {
  return (
    <Table compact unstackable>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Producto</Table.HeaderCell>
          <Table.HeaderCell>Categoría</Table.HeaderCell>
          {canManageStock && <Table.HeaderCell>Stock</Table.HeaderCell>}
          {canManageStock && <Table.HeaderCell>Vendidos hoy</Table.HeaderCell>}
          {canToggle && <Table.HeaderCell>Agotado hoy</Table.HeaderCell>}
          {canManageStock && <Table.HeaderCell />}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {products.map((product) => (
          <Table.Row key={product.id} negative={!product.is_available} warning={product.low_stock}>
            <Table.Cell>{product.title}</Table.Cell>
            <Table.Cell>{product.category_data?.title ?? EMPTY_VALUE}</Table.Cell>
            {canManageStock && <Table.Cell>{formatStock(product.stock)}</Table.Cell>}
            {canManageStock && <Table.Cell>{product.sold_today ?? EMPTY_VALUE}</Table.Cell>}
            {canToggle && (
              <Table.Cell>
                <Checkbox
                  toggle
                  aria-label={`Agotado hoy: ${product.title}`}
                  checked={Boolean(product.sold_out_today)}
                  disabled={togglingId === product.id}
                  onChange={(_, data) => onToggle(product, !data.checked)}
                />
              </Table.Cell>
            )}
            {canManageStock && (
              <Table.Cell textAlign="right">
                {product.stock !== null && product.stock !== undefined && (
                  <StockActions product={product} onStockForm={onStockForm} onHistory={onHistory} />
                )}
              </Table.Cell>
            )}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function StockActions({ product, onStockForm, onHistory }) {
  return (
    <>
      <Button size="mini" positive onClick={() => onStockForm(product, STOCK_FORM_MODE.ADD)}>
        Sumar
      </Button>
      <Button size="mini" basic onClick={() => onStockForm(product, STOCK_FORM_MODE.SET)}>
        Ajustar
      </Button>
      <Button size="mini" basic icon aria-label={`Movimientos de ${product.title}`} onClick={() => onHistory(product)}>
        <Icon name="history" />
      </Button>
    </>
  );
}
