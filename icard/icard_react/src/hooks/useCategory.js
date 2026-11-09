import { categoryApi } from "../api/category";
import { useCrudResource } from "./useCrudResource";

export function useCategory() {
  const { loading, error, items, getItems, addItem, updateItem, deleteItem } = useCrudResource(categoryApi);

  return {
    loading,
    error,
    categories: items,
    getCategories: getItems,
    addCategory: addItem,
    updateCategory: updateItem,
    deleteCategory: deleteItem,
  };
}
