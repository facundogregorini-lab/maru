"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

/** Aviso al volver del magic link (?ingreso=ok | vencido), en cualquier página. */
export default function LoginNotice() {
  const { email } = useAuth();
  const [notice, setNotice] = useState<"ok" | "vencido" | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ingreso = url.searchParams.get("ingreso");
    if (ingreso !== "ok" && ingreso !== "vencido") return;
    setNotice(ingreso);
    url.searchParams.delete("ingreso");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  if (!notice) return null;
  return (
    <div
      role="status"
      className={`animate-rise mb-6 flex items-start justify-between gap-4 rounded-2xl px-5 py-4 text-sm ${
        notice === "ok" ? "bg-sage-soft text-ink" : "border border-danger/30 bg-danger-soft text-danger-dark"
      }`}
    >
      <span>
        {notice === "ok" ? (
          <>
            <b className="text-sage">¡Listo{email ? `, entraste como ${email}` : ""}!</b> Este navegador te va a recordar. Lo que estabas armando sigue acá.
          </>
        ) : (
          "El link venció o no es válido. Tocá «Ingresar» y te mandamos uno nuevo."
        )}
      </span>
      <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="shrink-0 text-muted hover:text-ink">
        ✕
      </button>
    </div>
  );
}
