"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setSyncAccount } from "@/lib/sync/client";

type AuthState = {
  /** undefined = cargando; null = sin sesión. */
  email: string | null | undefined;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({ email: undefined, refresh: async () => null, logout: async () => {} });

export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { email: string | null };
      setEmail(data.email);
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

  // Con sesión, el perfil, el match y el seguimiento se guardan también en la cuenta.
  useEffect(() => {
    if (email !== undefined) setSyncAccount(email);
  }, [email]);

  return <AuthCtx.Provider value={{ email, refresh, logout }}>{children}</AuthCtx.Provider>;
}
