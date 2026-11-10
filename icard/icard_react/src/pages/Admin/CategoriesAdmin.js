import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditCategoryForm, HeaderPage, TableCategoryAdmin } from "../../components/Admin";
import { ModalBasic, TableFilters } from "../../components/Common";
import { useCategory, useFormModal, useTableFilters } from "../../hooks";
import { CATEGORY_FILTERS, VISIBLE_OPTIONS } from "../../utils/catalogFilters";
import { notifyError } from "../../utils/notify";

const CATEGORY_SELECTS = [{ name: "active", label: "En la carta", options: VISIBLE_OPTIONS }];

export function CategoriesAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { categories, getCategories, deleteCategory } = useCategory();
  const categoryFilters = useTableFilters(categories, CATEGORY_FILTERS);

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

      {categories === null ? (
        <Loader active inline="centered">
          Cargando ...
        </Loader>
      ) : (
        <>
          <TableFilters state={categoryFilters} selects={CATEGORY_SELECTS} searchPlaceholder="Buscar categoría" />
          <TableCategoryAdmin
            categories={categoryFilters.filtered}
            updateCategory={updateCategory}
            onDeleteCategory={onDeleteCategory}
          />
        </>
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
