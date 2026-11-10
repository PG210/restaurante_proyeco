export const BASE_API = process.env.REACT_APP_API_URL;

export const PUBLIC_URL = process.env.REACT_APP_PUBLIC_URL || window.location.origin;

export const TOKEN = "token";
export const REFRESH_TOKEN = "refreshToken";

export const ROLE_OPTIONS = [
  { key: "mesero", text: "Mesero", value: "mesero" },
  { key: "cocina", text: "Cocina", value: "cocina" },
  { key: "caja", text: "Caja", value: "caja" },
];

export const EMPTY_VALUE = "—";

export const ORDERS_POLL_MS = 10000;
export const KITCHEN_POLL_MS = 5000;
export const KITCHEN_LATE_MINUTES = 15;

export const CUSTOMER_POLL_MS = 10000;
export const CUSTOMER_MAX_QUANTITY = 20;
export const CUSTOMER_MAX_ITEMS = 20;
export const DEFAULT_RETRY_AFTER_SECONDS = 30;
