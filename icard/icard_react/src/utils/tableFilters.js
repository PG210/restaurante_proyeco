export const ALL_VALUES = "";

const DIACRITICS = /[̀-ͯ]/g;

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim();
}

export function matchesSearch(item, fields, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  return fields.some((field) => normalizeText(readField(item, field)).includes(normalizedQuery));
}

function readField(item, field) {
  return typeof field === "function" ? field(item) : item[field];
}

export function applyFilters(items, { search = "", searchFields = [], filters = {}, predicates = {} }) {
  const activeFilters = Object.entries(filters).filter(([, value]) => value !== ALL_VALUES);
  return (items ?? []).filter(
    (item) =>
      matchesSearch(item, searchFields, search) &&
      activeFilters.every(([name, value]) => predicates[name](item, value)),
  );
}

export function booleanOptions(trueText, falseText) {
  return [
    { key: "true", text: trueText, value: "true" },
    { key: "false", text: falseText, value: "false" },
  ];
}

export function matchesBoolean(value, filterValue) {
  return String(Boolean(value)) === filterValue;
}

export function emptyFilters(filterNames) {
  return Object.fromEntries(filterNames.map((name) => [name, ALL_VALUES]));
}
