import { productApi } from "../api/product";
import { useCrudResource } from "./useCrudResource";

export function useProduct() {
  const { loading, error, items, getItems, addItem, updateItem, deleteItem, replaceItem } =
    useCrudResource(productApi);

  return {
    loading,
    error,
    products: items,
    getProducts: getItems,
    addProduct: addItem,
    updateProduct: updateItem,
    deleteProduct: deleteItem,
    replaceProduct: replaceItem,
  };
}
