const LOCAL = "localStorage";
export const SESSION = "sessionStorage";

export function readJson(key, fallback, storage = LOCAL) {
  try {
    const raw = window[storage].getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value, storage = LOCAL) {
  try {
    window[storage].setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
