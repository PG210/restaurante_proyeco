export const BASE_API = process.env.REACT_APP_API_URL;

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
