import { CUSTOMER_MAX_QUANTITY } from "./constants";

const MIN_QUANTITY = 1;

export function cartStorageKey(token) {
  return `icard-cart-${token}`;
}

function clampQuantity(quantity) {
  return Math.min(Math.max(Math.trunc(quantity) || MIN_QUANTITY, MIN_QUANTITY), CUSTOMER_MAX_QUANTITY);
}

export function addToCart(items, product) {
  const existing = items.find((item) => item.productId === product.id);
  if (existing) return updateQuantity(items, product.id, existing.quantity + 1);
  return [
    ...items,
    { productId: product.id, title: product.title, price: product.price, quantity: MIN_QUANTITY, notes: "" },
  ];
}

export function updateQuantity(items, productId, quantity) {
  return items.map((item) => (item.productId === productId ? { ...item, quantity: clampQuantity(quantity) } : item));
}

export function updateNotes(items, productId, notes) {
  return items.map((item) => (item.productId === productId ? { ...item, notes } : item));
}

export function removeFromCart(items, productId) {
  return items.filter((item) => item.productId !== productId);
}

export function cartCount(items) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function cartTotal(items) {
  return items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
}

export function toOrderItems(items) {
  return items.map(({ productId, quantity, notes }) => ({ product: productId, quantity, notes: notes.trim() }));
}

export function formatPrice(amount) {
  return `$${Number(amount).toFixed(2)}`;
}
