import { useCallback, useState } from "react";
import { useRequestState } from "./useRequestState";

export function useCrudResource(resourceApi) {
  const { loading, error, run } = useRequestState();
  const [items, setItems] = useState(null);

  const getItems = useCallback(
    (filters) =>
      run(async () => {
        const result = await resourceApi.list(filters);
        setItems(result);
        return result;
      }),
    [resourceApi, run],
  );

  const addItem = useCallback((data) => run(() => resourceApi.create(data)), [resourceApi, run]);

  const updateItem = useCallback((id, data) => run(() => resourceApi.update(id, data)), [resourceApi, run]);

  const deleteItem = useCallback((id) => run(() => resourceApi.remove(id)), [resourceApi, run]);

  return { loading, error, items, getItems, addItem, updateItem, deleteItem };
}
