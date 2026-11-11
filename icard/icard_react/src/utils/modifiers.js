import { formatPrice } from "./cart";

export function offeredGroups(product) {
  return product?.modifier_groups ?? [];
}

export function hasModifiers(product) {
  return offeredGroups(product).length > 0;
}

export function choicesHint(group) {
  if (group.min_choices === group.max_choices) {
    return `Elige ${group.min_choices}`;
  }
  if (group.min_choices === 0) {
    return group.max_choices === 1 ? "Opcional" : `Opcional, hasta ${group.max_choices}`;
  }
  return `Elige de ${group.min_choices} a ${group.max_choices}`;
}

export function choicesMessage(group) {
  if (group.min_choices === group.max_choices) {
    const noun = group.min_choices === 1 ? "opción" : "opciones";
    return `Elige ${group.min_choices} ${noun} en ${group.name}.`;
  }
  if (group.min_choices === 0) return `Elige como máximo ${group.max_choices} en ${group.name}.`;
  return `Elige entre ${group.min_choices} y ${group.max_choices} opciones en ${group.name}.`;
}

function chosenIn(group, selectedIds) {
  const groupIds = new Set(group.modifiers.map((modifier) => modifier.id));
  return selectedIds.filter((id) => groupIds.has(id));
}

export function selectionErrors(groups, selectedIds) {
  return groups.reduce((errors, group) => {
    const count = chosenIn(group, selectedIds).length;
    if (count < group.min_choices || count > group.max_choices) {
      return { ...errors, [group.id]: choicesMessage(group) };
    }
    return errors;
  }, {});
}

export function isSelectionValid(groups, selectedIds) {
  return Object.keys(selectionErrors(groups, selectedIds)).length === 0;
}

export function toggleModifier(group, selectedIds, modifierId) {
  if (selectedIds.includes(modifierId)) {
    return selectedIds.filter((id) => id !== modifierId);
  }
  const chosen = chosenIn(group, selectedIds);
  if (group.max_choices === 1) {
    return [...selectedIds.filter((id) => !chosen.includes(id)), modifierId];
  }
  if (chosen.length >= group.max_choices) return selectedIds;
  return [...selectedIds, modifierId];
}

export function selectedModifiers(groups, selectedIds) {
  return groups.flatMap((group) =>
    group.modifiers
      .filter((modifier) => selectedIds.includes(modifier.id))
      .map((modifier) => ({ id: modifier.id, name: modifier.name, price_delta: modifier.price_delta })),
  );
}

export function unitPrice(product, modifiers = []) {
  return modifiers.reduce((total, modifier) => total + Number(modifier.price_delta), Number(product.price));
}

export function formatDelta(priceDelta) {
  return Number(priceDelta) > 0 ? `+${formatPrice(priceDelta)}` : "";
}

export function modifierSummary(modifiers) {
  return (modifiers ?? []).map((modifier) => modifier.modifier_name ?? modifier.name).join(", ");
}

export function titleWithModifiers(title, modifiers) {
  const summary = modifierSummary(modifiers);
  return summary ? `${title} (${summary})` : title;
}
