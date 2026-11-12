import { apiRequest } from "./client";
import { toQueryString } from "./resource";

const CASH_CLOSINGS_PATH = "/api/cash-closings/";

export const reportsApi = {
  dashboard: () => apiRequest("/api/reports/dashboard/"),
};

export const cashClosingApi = {
  list: (page = 1) => apiRequest(`${CASH_CLOSINGS_PATH}${toQueryString({ page })}`),
  today: () => apiRequest(`${CASH_CLOSINGS_PATH}today/`),
  close: (count) => apiRequest(CASH_CLOSINGS_PATH, { method: "POST", body: count }),
  addNote: (id, text) => apiRequest(`${CASH_CLOSINGS_PATH}${id}/note/`, { method: "POST", body: { text } }),
  void: (id, text) => apiRequest(`${CASH_CLOSINGS_PATH}${id}/void/`, { method: "POST", body: { text } }),
};
