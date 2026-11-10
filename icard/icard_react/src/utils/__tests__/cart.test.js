import { CUSTOMER_MAX_QUANTITY } from "../constants";
import {
  addToCart,
  cartCount,
  cartStorageKey,
  cartTotal,
  formatPrice,
  removeFromCart,
  toOrderItems,
  updateNotes,
  updateQuantity,
} from "../cart";

const ICE_CREAM = { id: 1, title: "Helado", price: "4.50" };
const SOUP = { id: 2, title: "Sopa", price: "12.00" };

describe("cart", () => {
  it("adds a new product with quantity one", () => {
    expect(addToCart([], ICE_CREAM)).toEqual([
      { productId: 1, title: "Helado", price: "4.50", quantity: 1, notes: "" },
    ]);
  });

  it("increments the quantity when the product is already in the cart", () => {
    const items = addToCart(addToCart([], ICE_CREAM), ICE_CREAM);

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("does not mutate the previous cart", () => {
    const items = addToCart([], ICE_CREAM);
    addToCart(items, ICE_CREAM);

    expect(items[0].quantity).toBe(1);
  });

  it("never goes below one unit", () => {
    expect(updateQuantity(addToCart([], ICE_CREAM), 1, 0)[0].quantity).toBe(1);
  });

  it("caps the quantity at the API limit", () => {
    expect(updateQuantity(addToCart([], ICE_CREAM), 1, 99)[0].quantity).toBe(CUSTOMER_MAX_QUANTITY);
  });

  it("stores notes per product", () => {
    const items = updateNotes(addToCart(addToCart([], ICE_CREAM), SOUP), 2, "sin cebolla");

    expect(items.map((item) => item.notes)).toEqual(["", "sin cebolla"]);
  });

  it("removes a product", () => {
    const items = removeFromCart(addToCart(addToCart([], ICE_CREAM), SOUP), 1);

    expect(items.map((item) => item.productId)).toEqual([2]);
  });

  it("counts units and adds up the total", () => {
    const items = updateQuantity(addToCart(addToCart([], ICE_CREAM), SOUP), 1, 2);

    expect(cartCount(items)).toBe(3);
    expect(cartTotal(items)).toBe(21);
  });

  it("builds the order payload expected by the API", () => {
    const items = updateNotes(addToCart([], SOUP), 2, "  bien caliente ");

    expect(toOrderItems(items)).toEqual([{ product: 2, quantity: 1, notes: "bien caliente" }]);
  });

  it("keeps a separate cart per table", () => {
    expect(cartStorageKey("table-a")).not.toBe(cartStorageKey("table-b"));
  });

  it("formats prices with two decimals", () => {
    expect(formatPrice("4.5")).toBe("$4.50");
  });
});
