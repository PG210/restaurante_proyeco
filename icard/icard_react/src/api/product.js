import { apiRequest } from "./client";
import { createResourceApi, toFormData, toQueryString } from "./resource";

const PRODUCTS_PATH = "/api/products/";

export const productApi = {
  ...createResourceApi(PRODUCTS_PATH, { serialize: toFormData }),
  setAvailability: (id, isAvailable) =>
    apiRequest(`${PRODUCTS_PATH}${id}/availability/`, { method: "PATCH", body: { is_available: isAvailable } }),
  restock: () => apiRequest(`${PRODUCTS_PATH}restock/`, { method: "POST" }),
  addStock: (id, units) => apiRequest(`${PRODUCTS_PATH}${id}/stock/add/`, { method: "POST", body: { units } }),
  setStock: (id, units, note) =>
    apiRequest(`${PRODUCTS_PATH}${id}/stock/set/`, { method: "POST", body: { units, note } }),
  setModifierGroups: (id, modifierGroupIds) =>
    apiRequest(`${PRODUCTS_PATH}${id}/modifier-groups/`, {
      method: "PUT",
      body: { modifier_group_ids: modifierGroupIds },
    }),
  stockMovements: (id, page = 1) => apiRequest(`${PRODUCTS_PATH}${id}/stock-movements/${toQueryString({ page })}`),
};
