import { REFRESH_TOKEN, TOKEN } from "../utils/constants";

export function setTokens({ access, refresh }) {
  localStorage.setItem(TOKEN, access);
  localStorage.setItem(REFRESH_TOKEN, refresh);
}

export function setToken(token) {
  localStorage.setItem(TOKEN, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN);
}

export function removeTokens() {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(REFRESH_TOKEN);
}
