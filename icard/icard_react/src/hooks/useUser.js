import { userApi } from "../api/user";
import { useCrudResource } from "./useCrudResource";

export function useUser() {
  const { loading, error, items, getItems, addItem, updateItem, deleteItem } = useCrudResource(userApi);

  return {
    loading,
    error,
    users: items,
    getUsers: getItems,
    addUser: addItem,
    updateUser: updateItem,
    deleteUser: deleteItem,
  };
}
