import { apiRequest } from "./client";
import { toQueryString } from "./resource";

const SETTINGS_PATH = "/api/settings/";

export const configurationApi = {
  get: () => apiRequest(SETTINGS_PATH),
  update: (changes) => apiRequest(SETTINGS_PATH, { method: "PATCH", body: changes }),
  changes: (page) => apiRequest(`${SETTINGS_PATH}changes/${toQueryString({ page })}`),
};
