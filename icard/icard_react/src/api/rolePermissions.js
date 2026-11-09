import { apiRequest } from "./client";

export function getPermissionMatrixApi() {
  return apiRequest("/api/roles/permissions/");
}

export function updateRolePermissionsApi(role, permissions) {
  return apiRequest(`/api/roles/${encodeURIComponent(role)}/permissions/`, {
    method: "PUT",
    body: { permissions },
  });
}
