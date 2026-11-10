import React, { useCallback, useEffect, useMemo } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditProductForm, HeaderPage, TableProductAdmin } from "../../components/Admin";
import { ModalBasic, TableFilters } from "../../components/Common";
import { useAvailabilityToggle, useFormModal, useProduct, useTableFilters } from "../../hooks";
import {
  ON_MENU_OPTIONS,
  AVAILABLE_OPTIONS,
  PRODUCT_FILTERS,
  productCategoryOptions,
} from "../../utils/catalogFilters";
import { notifyError } from "../../utils/notify";

export function ProductAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { products, getProducts, deleteProduct, replaceProduct } = useProduct();
  const productFilters = useTableFilters(products, PRODUCT_FILTERS);
  const { togglingId, toggleAvailability } = useAvailabilityToggle(replaceProduct);

  const loadProducts = useCallback(() => getProducts().catch(notifyError), [getProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selects = useMemo(
    () => [
      { name: "category", label: "Categoría", options: productCategoryOptions(products) },
      { name: "active", label: "En la carta", options: ON_MENU_OPTIONS },
      { name: "available", label: "Disponibilidad", options: AVAILABLE_OPTIONS },
    ],
    [products],
  );

  const addProduct = () => {
    openModal("Nuevo Producto", <AddEditProductForm onClose={closeModal} onRefetch={loadProducts} />);
  };

  const updateProduct = (product) => {
    openModal(
      "Actualizar Producto",
      <AddEditProductForm onClose={closeModal} onRefetch={loadProducts} product={product} />,
    );
  };

  const onDeleteProduct = async (product) => {
    if (!window.confirm(`¿Estás seguro de eliminar el producto ${product.title}?`)) return;
    try {
      await deleteProduct(product.id);
      loadProducts();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <HeaderPage title="Administración de Productos" btnTitle="Nuevo Producto" btnClick={addProduct} />

      {products === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <>
          <TableFilters state={productFilters} selects={selects} searchPlaceholder="Buscar producto" />
          <TableProductAdmin
            products={productFilters.filtered}
            updateProduct={updateProduct}
            onDeleteProduct={onDeleteProduct}
            onToggleAvailability={toggleAvailability}
            togglingId={togglingId}
          />
        </>
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
