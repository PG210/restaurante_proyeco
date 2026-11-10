import { ROLE_OPTIONS } from "./constants";
import { booleanOptions, matchesBoolean } from "./tableFilters";

export const NO_CATEGORY = "none";
const NO_CATEGORY_TEXT = "Sin categoría";

const byCategory = (product, value) => String(product.category ?? NO_CATEGORY) === value;

export const PRODUCT_FILTERS = {
  searchFields: ["title", "description"],
  predicates: {
    category: byCategory,
    active: (product, value) => matchesBoolean(product.active, value),
    available: (product, value) => matchesBoolean(product.is_available, value),
  },
};

export const AVAILABILITY_FILTERS = {
  searchFields: ["title"],
  predicates: {
    category: byCategory,
    available: (product, value) => matchesBoolean(product.is_available, value),
  },
};

export const CATEGORY_FILTERS = {
  searchFields: ["title"],
  predicates: {
    active: (category, value) => matchesBoolean(category.active, value),
  },
};

export const USER_FILTERS = {
  searchFields: ["username", "email", "first_name", "last_name"],
  predicates: {
    role: (user, value) => (user.roles ?? []).includes(value),
    active: (user, value) => matchesBoolean(user.is_active, value),
    staff: (user, value) => matchesBoolean(user.is_staff, value),
  },
};

export const TABLE_FILTERS = {
  searchFields: [(table) => table.number],
  predicates: {
    open: (table, value) => matchesBoolean(table.is_open, value),
  },
};

export function productCategoryOptions(products) {
  const options = new Map();
  (products ?? []).forEach(({ category, category_data: categoryData }) => {
    const value = String(category ?? NO_CATEGORY);
    if (!options.has(value)) options.set(value, categoryData?.title ?? NO_CATEGORY_TEXT);
  });
  return [...options]
    .map(([value, text]) => ({ key: value, text, value }))
    .sort((first, second) => first.text.localeCompare(second.text, "es"));
}

export const AVAILABLE_OPTIONS = booleanOptions("Disponibles", "Agotados hoy");
export const ACTIVE_OPTIONS = booleanOptions("Activos", "Inactivos");
export const ON_MENU_OPTIONS = booleanOptions("En la carta", "Fuera de la carta");
export const VISIBLE_OPTIONS = booleanOptions("Visibles", "Ocultas");
export const STAFF_OPTIONS = booleanOptions("Staff", "No staff");
export const OPEN_OPTIONS = booleanOptions("Abiertas", "Cerradas");
export const ROLE_FILTER_OPTIONS = ROLE_OPTIONS;
