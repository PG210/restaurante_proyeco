import { useCallback, useEffect, useState } from "react";
import {
  addToCart,
  cartCount,
  cartStorageKey,
  cartTotal,
  removeFromCart,
  updateNotes,
  updateQuantity,
} from "../utils/cart";
import { readJson, writeJson } from "../utils/storage";

export function useCart(token) {
  const storageKey = cartStorageKey(token);
  const [items, setItems] = useState(() => readJson(storageKey, []));

  useEffect(() => {
    writeJson(storageKey, items);
  }, [storageKey, items]);

  const add = useCallback((product) => setItems((current) => addToCart(current, product)), []);
  const setQuantity = useCallback(
    (productId, quantity) => setItems((current) => updateQuantity(current, productId, quantity)),
    [],
  );
  const setNotes = useCallback((productId, notes) => setItems((current) => updateNotes(current, productId, notes)), []);
  const remove = useCallback((productId) => setItems((current) => removeFromCart(current, productId)), []);
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
