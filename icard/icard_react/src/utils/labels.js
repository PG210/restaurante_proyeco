export const ALLERGEN_NOTICE =
  "La información de alérgenos es orientativa. Si tienes una alergia, avisa al personal antes de pedir.";
export const NO_ALLERGENS_TEXT = "Sin alérgenos declarados";
export const UNREVIEWED_TEXT = "Consulta los alérgenos al personal";
export const EMPTY_MENU_FILTERS = { allergenIds: [], tagIds: [] };

export function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export function allergenSummary(product) {
  const allergens = product.allergens ?? [];
  if (allergens.length) return `Contiene: ${joinNames(allergens.map((allergen) => allergen.name.toLowerCase()))}`;
  return product.allergens_declared ? NO_ALLERGENS_TEXT : UNREVIEWED_TEXT;
}

export function hasMenuFilters(filters) {
  return filters.allergenIds.length > 0 || filters.tagIds.length > 0;
}

function idsOf(labels) {
  return new Set((labels ?? []).map((label) => label.id));
}

function isHiddenByAllergens(product, allergenIds) {
  if (!allergenIds.length) return false;
  if (!product.allergens_declared) return true;
  const contained = idsOf(product.allergens);
  return allergenIds.some((id) => contained.has(id));
}

function lacksTags(product, tagIds) {
  const tags = idsOf(product.tags);
  return tagIds.some((id) => !tags.has(id));
}

/**
 * Hides what contains a chosen allergen and, while an allergen filter is on, what nobody has reviewed:
 * a product without data must never look safe. Tags work the other way: a product needs every chosen tag.
 */
export function filterMenu(products, filters) {
  const visible = [];
  let unreviewed = 0;
  products.forEach((product) => {
    if (isHiddenByAllergens(product, filters.allergenIds)) {
      if (!product.allergens_declared) unreviewed += 1;
      return;
    }
    if (!lacksTags(product, filters.tagIds)) visible.push(product);
  });
  return { products: visible, hidden: products.length - visible.length, unreviewed };
}

export function hiddenMessage({ hidden, unreviewed }) {
  if (!hidden) return "";
  const base = `${hidden} producto(s) ocultos por los filtros`;
  return unreviewed ? `${base}, ${unreviewed} por no tener información de alérgenos.` : `${base}.`;
}

/** Keeps the chosen filters that still exist, so a deleted or deactivated label does not hide products. */
export function knownFilters(filters, allergens, tags) {
  const allergenIds = idsOf(allergens);
  const tagIds = idsOf(tags);
  return {
    allergenIds: (filters?.allergenIds ?? []).filter((id) => allergenIds.has(id)),
    tagIds: (filters?.tagIds ?? []).filter((id) => tagIds.has(id)),
  };
}

export function labelOptions(labels) {
  return (labels ?? []).map((label) => ({ key: label.id, value: label.id, text: label.name }));
}
