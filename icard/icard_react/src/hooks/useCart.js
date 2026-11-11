import { useCallback, useEffect, useState } from "react";
import {
  addToCart,
  cartCount,
  cartStorageKey,
  cartTotal,
  normalizeCart,
  removeFromCart,
  updateNotes,
  updateQuantity,
} from "../utils/cart";
import { readJson, writeJson } from "../utils/storage";

export function useCart(token) {
  const storageKey = cartStorageKey(token);
  const [items, setItems] = useState(() => normalizeCart(readJson(storageKey, [])));

  useEffect(() => {
    writeJson(storageKey, items);
  }, [storageKey, items]);

  const add = useCallback(
    (product, modifiers) => setItems((current) => addToCart(current, product, modifiers)),
    [],
  );
  const setQuantity = useCallback(
    (key, quantity) => setItems((current) => updateQuantity(current, key, quantity)),
    [],
  );
  const setNotes = useCallback((key, notes) => setItems((current) => updateNotes(current, key, notes)), []);
  const remove = useCallback((key) => setItems((current) => removeFromCart(current, key)), []);
  const clear = useCallback(() => setItems([]), []);

  return {
    items,
    count: cartCount(items),
    total: cartTotal(items),
    add,
    setQuantity,
    setNotes,
    remove,
    clear,
  };
}
