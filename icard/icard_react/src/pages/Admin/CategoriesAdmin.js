import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditCategoryForm, HeaderPage, TableCategoryAdmin } from "../../components/Admin";
import { ModalBasic } from "../../components/Common";
import { useCategory, useFormModal } from "../../hooks";
import { notifyError } from "../../utils/notify";

export function CategoriesAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { loading, categories, getCategories, deleteCategory } = useCategory();

  const loadCategories = useCallback(() => getCategories().catch(notifyError), [getCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const addCategory = () => {
    openModal("Nueva Categoría", <AddEditCategoryForm onClose={closeModal} onRefetch={loadCategories} />);
  };

  const updateCategory = (category) => {
    openModal(
      "Actualizar Categoría",
      <AddEditCategoryForm onClose={closeModal} onRefetch={loadCategories} category={category} />,
    );
  };

  const onDeleteCategory = async (category) => {
    if (!window.confirm(`¿Eliminar categoría ${category.title}?`)) return;
    try {
      await deleteCategory(category.id);
      loadCategories();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <HeaderPage title="Categorías" btnTitle="Nueva Categoría" btnClick={addCategory} />

      {loading ? (
        <Loader active inline="centered">
          Cargando ...
        </Loader>
      ) : (
        <TableCategoryAdmin
          categories={categories}
          updateCategory={updateCategory}
          onDeleteCategory={onDeleteCategory}
        />
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
