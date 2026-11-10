import { BASE_API } from "../utils/constants";
import { getRefreshToken, getToken, removeTokens, setToken } from "./token";

export const HTTP_NO_CONTENT = 204;
export const HTTP_UNAUTHORIZED = 401;
export const HTTP_FORBIDDEN = 403;
export const HTTP_NOT_FOUND = 404;
export const HTTP_TOO_MANY_REQUESTS = 429;

const REFRESH_PATH = "/api/auth/refresh/";
const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró. Inicia sesión de nuevo.";
const DEFAULT_ERROR_MESSAGE = "No se pudo completar la operación.";
const TOO_MANY_REQUESTS_MESSAGE = "Demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.";
const RETRY_AFTER_HEADER = "Retry-After";

export class ApiError extends Error {
  constructor(message, status, data = null, retryAfterSeconds = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseRetryAfter(response) {
  const seconds = Number.parseInt(response.headers?.get?.(RETRY_AFTER_HEADER), 10);
  return Number.isNaN(seconds) ? null : seconds;
}

function buildApiError(response, data) {
  if (response.status === HTTP_TOO_MANY_REQUESTS) {
    return new ApiError(TOO_MANY_REQUESTS_MESSAGE, response.status, data, parseRetryAfter(response));
  }
  return new ApiError(extractErrorMessage(data), response.status, data);
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
  if (!firstField) return DEFAULT_ERROR_MESSAGE;
  const fieldErrors = data[firstField];
  const firstError = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
  if (typeof firstError === "string") return `${firstField}: ${firstError}`;
  return firstErrorText(fieldErrors) ?? DEFAULT_ERROR_MESSAGE;
}

function firstErrorText(value) {
  if (typeof value === "string") return value;
  const entries = Array.isArray(value) ? value : Object.values(value ?? {});
  for (const entry of entries) {
    const text = firstErrorText(entry);
    if (text) return text;
  }
  return null;
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
  if (!response.ok) throw buildApiError(response, data);
  return data;
}
