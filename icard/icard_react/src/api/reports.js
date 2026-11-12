import { apiDownload, apiRequest } from "./client";
import { toQueryString } from "./resource";

const CASH_CLOSINGS_PATH = "/api/cash-closings/";
const CSV_EXPORT = "csv";

function salesReportPath(report, { from, to } = {}, exportFormat) {
  return `/api/reports/${report}/${toQueryString({ from, to, export: exportFormat })}`;
}

export const reportsApi = {
  dashboard: () => apiRequest("/api/reports/dashboard/"),
  sales: (report, range) => apiRequest(salesReportPath(report, range)),
  downloadSales: (report, range) => apiDownload(salesReportPath(report, range, CSV_EXPORT)),
};

export const cashClosingApi = {
  list: (page = 1) => apiRequest(`${CASH_CLOSINGS_PATH}${toQueryString({ page })}`),
  today: () => apiRequest(`${CASH_CLOSINGS_PATH}today/`),
  close: (count) => apiRequest(CASH_CLOSINGS_PATH, { method: "POST", body: count }),
  addNote: (id, text) => apiRequest(`${CASH_CLOSINGS_PATH}${id}/note/`, { method: "POST", body: { text } }),
  void: (id, text) => apiRequest(`${CASH_CLOSINGS_PATH}${id}/void/`, { method: "POST", body: { text } }),
};
