import { apiRequest } from "./client";
import { toQueryString } from "./resource";

const ORDERS_PATH = "/api/orders/";
const orderPath = (id, action) => `${ORDERS_PATH}${id}/${action}/`;

export const orderApi = {
  list: (filters) => apiRequest(`${ORDERS_PATH}${toQueryString(filters)}`),
  createBulk: (tableId, items) =>
    apiRequest(`${ORDERS_PATH}bulk/`, { method: "POST", body: { table: tableId, items } }),
  advance: (id) => apiRequest(orderPath(id, "advance"), { method: "POST" }),
  bulkAdvance: (ids) => apiRequest(`${ORDERS_PATH}bulk-advance/`, { method: "POST", body: { ids } }),
  cancel: (id, reason) => apiRequest(orderPath(id, "cancel"), { method: "POST", body: { reason } }),
};

export function getTablesSummaryApi() {
  return apiRequest("/api/tables/summary/");
}
