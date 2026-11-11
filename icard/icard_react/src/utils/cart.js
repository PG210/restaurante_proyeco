import { CUSTOMER_MAX_QUANTITY } from "./constants";

const MIN_QUANTITY = 1;

export function cartStorageKey(token) {
  return `icard-cart-${token}`;
}

function clampQuantity(quantity) {
  return Math.min(Math.max(Math.trunc(quantity) || MIN_QUANTITY, MIN_QUANTITY), CUSTOMER_MAX_QUANTITY);
}

export function lineKey(productId, modifierIds = []) {
  return [productId, ...[...modifierIds].sort((a, b) => a - b)].join("-");
}

function linePrice(product, modifiers) {
  return modifiers.reduce((total, modifier) => total + Number(modifier.price_delta), Number(product.price)).toFixed(2);
}

export function addToCart(items, product, modifiers = []) {
  const key = lineKey(
    product.id,
    modifiers.map((modifier) => modifier.id),
  );
  const existing = items.find((item) => item.key === key);
  if (existing) return updateQuantity(items, key, existing.quantity + 1);
  return [
    ...items,
    {
      key,
      productId: product.id,
      title: product.title,
      price: linePrice(product, modifiers),
      modifiers: modifiers.map(({ id, name }) => ({ id, name })),
      quantity: MIN_QUANTITY,
      notes: "",
    },
  ];
}

export function updateQuantity(items, key, quantity) {
  return items.map((item) => (item.key === key ? { ...item, quantity: clampQuantity(quantity) } : item));
}

export function updateNotes(items, key, notes) {
  return items.map((item) => (item.key === key ? { ...item, notes } : item));
}

export function removeFromCart(items, key) {
  return items.filter((item) => item.key !== key);
}

function isValidLine(item) {
  return Boolean(item) && Number.isInteger(item.productId) && item.price !== undefined && Number(item.quantity) > 0;
}

function upgradeLine(item) {
  const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
  return {
    ...item,
    key: lineKey(
      item.productId,
      modifiers.map((modifier) => modifier.id),
    ),
    modifiers,
    notes: typeof item.notes === "string" ? item.notes : "",
  };
}

export function normalizeCart(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.filter(isValidLine).map(upgradeLine);
}

export function cartCount(items) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function cartTotal(items) {
  return items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
}

export function toOrderItems(items) {
  return items.map(({ productId, quantity, notes, modifiers }) => ({
    product: productId,
    quantity,
    notes: notes.trim(),
    modifiers: modifiers.map((modifier) => modifier.id),
  }));
}

export function formatPrice(amount) {
  return `$${Number(amount).toFixed(2)}`;
}
