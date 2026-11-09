import { useCallback, useState } from "react";

export function useSelection(selectableIds) {
  const [chosenIds, setChosenIds] = useState([]);

  const selectedIds = chosenIds.filter((id) => selectableIds.includes(id));
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggle = useCallback(
    (id) => setChosenIds((current) => (current.includes(id) ? current.filter((chosen) => chosen !== id) : [...current, id])),
    [],
  );

  const toggleAll = () => setChosenIds(allSelected ? [] : [...selectableIds]);

  const clear = useCallback(() => setChosenIds([]), []);

  return { selectedIds, allSelected, someSelected, toggle, toggleAll, clear };
}
