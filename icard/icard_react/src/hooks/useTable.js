import { tableApi } from "../api/table";
import { useCrudResource } from "./useCrudResource";

export function useTable() {
  const { loading, error, items, getItems, addItem, updateItem, deleteItem } = useCrudResource(tableApi);

  return {
    loading,
    error,
    tables: items,
    getTables: getItems,
    addTable: addItem,
    updateTable: updateItem,
    deleteTable: deleteItem,
  };
}
