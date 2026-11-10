import { apiRequest } from "./client";
import { createResourceApi, toFormData } from "./resource";

const PRODUCTS_PATH = "/api/products/";

export const productApi = {
  ...createResourceApi(PRODUCTS_PATH, { serialize: toFormData }),
  setAvailability: (id, isAvailable) =>
    apiRequest(`${PRODUCTS_PATH}${id}/availability/`, { method: "PATCH", body: { is_available: isAvailable } }),
  restock: () => apiRequest(`${PRODUCTS_PATH}restock/`, { method: "POST" }),
};
