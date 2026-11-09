import { apiRequest } from "./client";

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

export function toFormData(data) {
  const formData = new FormData();
  Object.entries(data)
    .filter(([, value]) => hasValue(value))
    .forEach(([field, value]) => formData.append(field, value));
  return formData;
}

export function toQueryString(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => hasValue(value)));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function createResourceApi(basePath, { serialize = (data) => data, updateMethod = "PATCH" } = {}) {
  const itemPath = (id) => `${basePath}${id}/`;

  return {
    list: (filters) => apiRequest(`${basePath}${toQueryString(filters)}`),
    retrieve: (id) => apiRequest(itemPath(id)),
    create: (data) => apiRequest(basePath, { method: "POST", body: serialize(data) }),
    update: (id, data) => apiRequest(itemPath(id), { method: updateMethod, body: serialize(data) }),
    remove: (id) => apiRequest(itemPath(id), { method: "DELETE" }),
  };
}
