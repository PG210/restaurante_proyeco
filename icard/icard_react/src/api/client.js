import { BASE_API } from "../utils/constants";
import { getRefreshToken, getToken, removeTokens, setToken } from "./token";

export const HTTP_NO_CONTENT = 204;
export const HTTP_UNAUTHORIZED = 401;

const REFRESH_PATH = "/api/auth/refresh/";
const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró. Inicia sesión de nuevo.";
const DEFAULT_ERROR_MESSAGE = "No se pudo completar la operación.";

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let sessionExpiredHandler = () => {};
let pendingRefresh = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

function isFormData(body) {
  return body instanceof FormData;
}

function buildHeaders(body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isFormData(body)) headers["Content-Type"] = "application/json";
  return headers;
}

function serializeBody(body) {
  if (body === undefined || isFormData(body)) return body;
  return JSON.stringify(body);
}

function send(path, { method = "GET", body, auth = true }) {
  return fetch(`${BASE_API}${path}`, {
    method,
    headers: buildHeaders(body, auth ? getToken() : null),
    body: serializeBody(body),
  });
}

async function parseBody(response) {
  if (response.status === HTTP_NO_CONTENT) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function extractErrorMessage(data) {
  if (!data) return DEFAULT_ERROR_MESSAGE;
  if (data.detail) return data.detail;
  const [firstField] = Object.keys(data);
  const fieldErrors = data[firstField];
  const firstError = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
  return firstField ? `${firstField}: ${firstError}` : DEFAULT_ERROR_MESSAGE;
}

async function requestNewAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const response = await send(REFRESH_PATH, { method: "POST", body: { refresh }, auth: false });
  if (!response.ok) return false;
  const { access } = await response.json();
  setToken(access);
  return true;
}

function refreshAccessToken() {
  if (!pendingRefresh) {
    pendingRefresh = requestNewAccessToken().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

async function sendWithRefresh(path, options) {
  const response = await send(path, options);
  if (response.status !== HTTP_UNAUTHORIZED || !options.auth || !getToken()) return response;

  const refreshed = await refreshAccessToken();
  if (refreshed) return send(path, options);

  removeTokens();
  sessionExpiredHandler();
  throw new ApiError(SESSION_EXPIRED_MESSAGE, HTTP_UNAUTHORIZED);
}

export async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const response = await sendWithRefresh(path, { method, body, auth });
  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(extractErrorMessage(data), response.status, data);
  return data;
}
