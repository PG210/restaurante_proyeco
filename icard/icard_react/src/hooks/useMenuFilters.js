import { useCallback, useEffect, useMemo, useState } from "react";
import { customerApi } from "../api/customer";
import { EMPTY_MENU_FILTERS, knownFilters } from "../utils/labels";
import { SESSION, readJson, writeJson } from "../utils/storage";

export const MENU_FILTERS_KEY = "icard.menuFilters";

function asIds(value) {
  return Array.isArray(value) ? value.filter(Number.isInteger) : [];
}

function readSaved() {
  const saved = readJson(MENU_FILTERS_KEY, EMPTY_MENU_FILTERS, SESSION);
  return { allergenIds: asIds(saved?.allergenIds), tagIds: asIds(saved?.tagIds) };
}

/**
 * The customer's allergen and tag filters, kept for the visit and shared by every category.
 * Until the lists arrive, or if they fail, the saved filters keep applying: hiding too much is safer.
 */
export function useMenuFilters() {
  const [labels, setLabels] = useState(null);
  const [saved, setSaved] = useState(readSaved);

  useEffect(() => {
    let active = true;
    Promise.all([customerApi.getAllergens(), customerApi.getTags()])
      .then(([allergens, tags]) => active && setLabels({ allergens, tags }))
      .catch(() => active && setLabels({ allergens: [], tags: [], failed: true }));
    return () => {
      active = false;
    };
  }, []);

  const filters = useMemo(
    () => (labels && !labels.failed ? knownFilters(saved, labels.allergens, labels.tags) : saved),
    [labels, saved],
  );

  const setFilters = useCallback((next) => {
    setSaved(next);
    writeJson(MENU_FILTERS_KEY, next, SESSION);
  }, []);

  return { labels, filters, setFilters };
}
