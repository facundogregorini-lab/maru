"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type AuthState = {
  /** undefined = cargando; null = sin sesión. */
  email: string | null | undefined;
  /** Si está configurado "Continuar con Google". */
  google: boolean;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({ email: undefined, google: false, refresh: async () => null, logout: async () => {} });

export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [google, setGoogle] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { email: string | null; google?: boolean };
      setEmail(data.email);
      setGoogle(data.google === true);
      return data.email;
    } catch {
      setEmail(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setEmail(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AuthCtx.Provider value={{ email, google, refresh, logout }}>{children}</AuthCtx.Provider>;
}
