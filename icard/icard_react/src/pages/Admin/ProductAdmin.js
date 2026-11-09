import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditProductForm, HeaderPage, TableProductAdmin } from "../../components/Admin";
import { ModalBasic } from "../../components/Common";
import { useFormModal, useProduct } from "../../hooks";
import { notifyError } from "../../utils/notify";

export function ProductAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { products, loading, getProducts, deleteProduct } = useProduct();

  const loadProducts = useCallback(() => getProducts().catch(notifyError), [getProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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

      {loading ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <TableProductAdmin products={products} updateProduct={updateProduct} onDeleteProduct={onDeleteProduct} />
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
