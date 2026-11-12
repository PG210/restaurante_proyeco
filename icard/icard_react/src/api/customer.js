import { apiRequest } from "./client";
import { toQueryString } from "./resource";

const PUBLIC_REQUEST = { auth: false };

function customerPath(token, resource) {
  const base = `/api/client/${encodeURIComponent(token)}/`;
  return resource ? `${base}${resource}/` : base;
}

export const customerApi = {
  getTable: (token) => apiRequest(customerPath(token), PUBLIC_REQUEST),
  getOrders: (token) => apiRequest(customerPath(token, "orders"), PUBLIC_REQUEST),
  createOrders: (token, items) =>
    apiRequest(customerPath(token, "orders"), { ...PUBLIC_REQUEST, method: "POST", body: { items } }),
  requestBill: (token) => apiRequest(customerPath(token, "bill"), { ...PUBLIC_REQUEST, method: "POST" }),
  callWaiter: (token) => apiRequest(customerPath(token, "call-waiter"), { ...PUBLIC_REQUEST, method: "POST" }),
  getCategories: () => apiRequest("/api/categories/", PUBLIC_REQUEST),
  getAllergens: () => apiRequest("/api/allergens/", PUBLIC_REQUEST),
  getTags: () => apiRequest("/api/tags/", PUBLIC_REQUEST),
  getProducts: (categoryId) =>
    apiRequest(`/api/products/${toQueryString({ category: categoryId, active: true })}`, PUBLIC_REQUEST),
};
