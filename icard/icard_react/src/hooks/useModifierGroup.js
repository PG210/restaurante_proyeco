import { modifierGroupApi } from "../api/modifierGroup";
import { useCrudResource } from "./useCrudResource";

export function useModifierGroup() {
  const { loading, error, items, getItems, addItem, updateItem, deleteItem } = useCrudResource(modifierGroupApi);

  return {
    loading,
    error,
    modifierGroups: items,
    getModifierGroups: getItems,
    addModifierGroup: addItem,
    updateModifierGroup: updateItem,
    deleteModifierGroup: deleteItem,
  };
}
