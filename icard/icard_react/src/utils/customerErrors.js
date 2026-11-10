import { HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_TOO_MANY_REQUESTS } from "../api/client";
import { DEFAULT_RETRY_AFTER_SECONDS } from "./constants";

const MILLISECONDS_PER_SECOND = 1000;

export const CUSTOMER_ERROR_VIEW = {
  INVALID_QR: "invalid_qr",
  TABLE_CLOSED: "table_closed",
  THROTTLED: "throttled",
  GENERIC: "generic",
};

const VIEW_BY_STATUS = {
  [HTTP_NOT_FOUND]: CUSTOMER_ERROR_VIEW.INVALID_QR,
  [HTTP_FORBIDDEN]: CUSTOMER_ERROR_VIEW.TABLE_CLOSED,
  [HTTP_TOO_MANY_REQUESTS]: CUSTOMER_ERROR_VIEW.THROTTLED,
};

export function getCustomerErrorView(error) {
  return VIEW_BY_STATUS[error?.status] ?? CUSTOMER_ERROR_VIEW.GENERIC;
}

export function isThrottled(error) {
  return error?.status === HTTP_TOO_MANY_REQUESTS;
}

export function getRetryDelayMs(error) {
  return (error?.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS) * MILLISECONDS_PER_SECOND;
}
