import { PUBLIC_URL } from "./constants";

export const CUSTOMER_ROUTES = {
  menu: "/client/:token",
  category: "/client/:token/category/:categoryId",
  cart: "/client/:token/cart",
  orders: "/client/:token/orders",
};

export function customerPath(token, section = "menu", params = {}) {
  return Object.entries({ token, ...params }).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    CUSTOMER_ROUTES[section],
  );
}

export function buildCustomerUrl(token, baseUrl = PUBLIC_URL) {
  return `${baseUrl.replace(/\/+$/, "")}${customerPath(token)}`;
}
