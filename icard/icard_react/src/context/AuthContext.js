import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { setSessionExpiredHandler } from "../api/client";
import { getToken, removeTokens, setTokens } from "../api/token";
import { getMeApi } from "../api/user";
import { notifyError } from "../utils/notify";

export const AuthContext = createContext({
  auth: undefined,
  login: () => null,
  logout: () => null,
});

async function restoreSession() {
  if (!getToken()) return null;
  try {
    const me = await getMeApi();
    return { me };
  } catch (error) {
    removeTokens();
    notifyError(error);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(undefined);

  useEffect(() => {
    setSessionExpiredHandler(() => setAuth(null));
    restoreSession().then(setAuth);
  }, []);

  const login = useCallback(async (tokens) => {
    setTokens(tokens);
    try {
      const me = await getMeApi();
      setAuth({ me });
    } catch (error) {
      removeTokens();
      notifyError(error);
    }
  }, []);

  const logout = useCallback(() => {
    removeTokens();
    setAuth(null);
  }, []);

  const valueContext = useMemo(() => ({ auth, login, logout }), [auth, login, logout]);

  if (auth === undefined) return null;

  return <AuthContext.Provider value={valueContext}>{children}</AuthContext.Provider>;
}
