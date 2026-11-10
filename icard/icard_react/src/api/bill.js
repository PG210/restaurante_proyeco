import { apiRequest } from "./client";
import { toQueryString } from "./resource";

const BILLS_PATH = "/api/bills/";

export const billApi = {
  current: (tableId) => apiRequest(`${BILLS_PATH}current/${toQueryString({ table: tableId })}`),
  retrieve: (billId) => apiRequest(`${BILLS_PATH}${billId}/`),
  charge: (billId, payment) => apiRequest(`${BILLS_PATH}${billId}/payments/`, { method: "POST", body: payment }),
  list: (filters) => apiRequest(`${BILLS_PATH}${toQueryString(filters)}`),
  summary: (filters) => apiRequest(`${BILLS_PATH}summary/${toQueryString(filters)}`),
  reversePayment: (paymentId, reason) =>
    apiRequest(`/api/payments/${paymentId}/reverse/`, { method: "POST", body: { reason } }),
};
