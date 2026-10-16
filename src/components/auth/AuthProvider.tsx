"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type AuthState = {
  /** undefined = cargando; null = sin sesión. */
  email: string | null | undefined;
  /** Tiene el plan Maru activo. */
  paid: boolean;
  /** Está configurado el ingreso con Google. */
  google: boolean;
  /** Se puede contratar el plan. */
  payments: boolean;
  /** Hay base de datos: alertas y sincronización disponibles. */
  db: boolean;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState>({ email: undefined, paid: false, google: false, payments: false, db: false, refresh: async () => null, logout: async () => {} });

export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [paid, setPaid] = useState(false);
  const [google, setGoogle] = useState(false);
  const [payments, setPayments] = useState(false);
  const [db, setDb] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { email: string | null; paid?: boolean; google?: boolean; payments?: boolean; db?: boolean };
      setEmail(data.email);
      setPaid(!!data.paid);
      setGoogle(!!data.google);
      setPayments(!!data.payments);
      setDb(!!data.db);
      return data.email;
    } catch {
      setEmail(null);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setEmail(null);
    setPaid(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AuthCtx.Provider value={{ email, paid, google, payments, db, refresh, logout }}>{children}</AuthCtx.Provider>;
}
