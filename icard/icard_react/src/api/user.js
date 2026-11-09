import { ApiError, HTTP_UNAUTHORIZED, apiRequest } from "./client";
import { createResourceApi } from "./resource";

const INVALID_CREDENTIALS_MESSAGE = "Usuario o contraseña son incorrectos";

export async function loginApi(credentials) {
  try {
    return await apiRequest("/api/auth/login/", { method: "POST", body: credentials, auth: false });
  } catch (error) {
    if (error.status === HTTP_UNAUTHORIZED) {
      throw new ApiError(INVALID_CREDENTIALS_MESSAGE, error.status, error.data);
    }
    throw error;
  }
}

export function getMeApi() {
  return apiRequest("/api/auth/me/");
}

export const userApi = createResourceApi("/api/users/", { updateMethod: "PUT" });
