import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { applyFilters, emptyFilters } from "../utils/tableFilters";

export function useTableFilters(items, { searchFields, predicates = {} }) {
  const filterNames = useMemo(() => Object.keys(predicates), [predicates]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => emptyFilters(filterNames));
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(
    () => applyFilters(items, { search: deferredSearch, searchFields, filters, predicates }),
    [items, deferredSearch, searchFields, filters, predicates],
  );

  const setFilter = useCallback((name, value) => setFilters((current) => ({ ...current, [name]: value })), []);

  const reset = useCallback(() => {
    setSearch("");
    setFilters(emptyFilters(filterNames));
  }, [filterNames]);

  return {
    filtered,
    total: items?.length ?? 0,
    search,
    setSearch,
    filters,
    setFilter,
    reset,
  };
}
