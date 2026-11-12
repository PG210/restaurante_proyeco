import { apiDownload, apiRequest } from "./client";
import { toQueryString } from "./resource";
import { EXPORT_FORMATS } from "../utils/salesReports";

const CASH_CLOSINGS_PATH = "/api/cash-closings/";

function salesReportPath(report, { from, to } = {}, exportFormat) {
  return `/api/reports/${report}/${toQueryString({ from, to, export: exportFormat })}`;
}

export const reportsApi = {
  dashboard: () => apiRequest("/api/reports/dashboard/"),
  sales: (report, range) => apiRequest(salesReportPath(report, range)),
  downloadSales: (report, range, format = EXPORT_FORMATS.CSV) =>
    apiDownload(salesReportPath(report, range, format)),
};

export const cashClosingApi = {
  list: (page = 1) => apiRequest(`${CASH_CLOSINGS_PATH}${toQueryString({ page })}`),
  today: () => apiRequest(`${CASH_CLOSINGS_PATH}today/`),
  close: (count) => apiRequest(CASH_CLOSINGS_PATH, { method: "POST", body: count }),
  addNote: (id, text) => apiRequest(`${CASH_CLOSINGS_PATH}${id}/note/`, { method: "POST", body: { text } }),
  void: (id, text) => apiRequest(`${CASH_CLOSINGS_PATH}${id}/void/`, { method: "POST", body: { text } }),
};
