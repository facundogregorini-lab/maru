"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { setSyncAccount } from "@/lib/sync/client";

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
    try { const channel = new BroadcastChannel("maru-auth"); channel.postMessage("logout"); channel.close(); } catch { /* sin canal */ }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("maru-auth");
      channel.onmessage = (e) => { if (e.data === "ok" || e.data === "logout") void refresh(); };
    } catch { /* En navegadores sin canal queda el refresco al volver a la pestaña. */ }
    return () => { window.removeEventListener("focus", onFocus); channel?.close(); };
  }, [refresh]);

  // Con sesión, el perfil, el match y el seguimiento se guardan también en la cuenta.
  useEffect(() => {
    if (email !== undefined) setSyncAccount(email);
  }, [email]);

  return <AuthCtx.Provider value={{ email, google, refresh, logout }}>{children}</AuthCtx.Provider>;
}
