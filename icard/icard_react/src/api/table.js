import { apiRequest } from "./client";
import { createResourceApi } from "./resource";

const TABLES_PATH = "/api/tables/";
const tableActionPath = (id, action) => `${TABLES_PATH}${id}/${action}/`;

export const tableApi = {
  ...createResourceApi(TABLES_PATH, { updateMethod: "PUT" }),
  open: (id) => apiRequest(tableActionPath(id, "open"), { method: "POST" }),
  close: (id) => apiRequest(tableActionPath(id, "close"), { method: "POST" }),
  attendBill: (id) => apiRequest(tableActionPath(id, "attend-bill"), { method: "POST" }),
  regenerateToken: (id) => apiRequest(tableActionPath(id, "regenerate-token"), { method: "POST" }),
};
