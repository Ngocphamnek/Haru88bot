import { useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const STORAGE_KEY = "haru88_admin_token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Wire Authorization header for all API client calls
setAuthTokenGetter(() => readStoredToken());

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(readStoredToken());
    setReady(true);
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
    setAuthTokenGetter(() => readStoredToken());
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setAuthTokenGetter(() => null);
  }, []);

  return {
    token,
    ready,
    isAuthenticated: Boolean(token),
    login,
    logout,
  };
}
