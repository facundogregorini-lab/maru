"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

type Notice = "ok" | "vencido" | "google-cancelado" | "google-error" | "google-no-configurado";

const MESSAGES: Record<Exclude<Notice, "ok">, string> = {
  vencido: "El link venció o no es válido. Tocá «Ingresar» y te mandamos uno nuevo.",
  "google-cancelado": "Cancelaste el ingreso con Google. Podés probar de nuevo o pedir un link por email.",
  "google-error": "No pudimos completar el ingreso con Google. Probá de nuevo o pedí un link por email.",
  "google-no-configurado": "El ingreso con Google todavía no está disponible. Pedí un link por email.",
};

/** Aviso al volver del magic link o de Google (?ingreso=ok | vencido | google-…), en cualquier página. */
export default function LoginNotice() {
  const { email } = useAuth();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ingreso = url.searchParams.get("ingreso");
    if (!ingreso || (ingreso !== "ok" && !(ingreso in MESSAGES))) return;
    setNotice(ingreso as Notice);
    url.searchParams.delete("ingreso");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  if (!notice) return null;
  return (
    <div
      role="status"
      className={`animate-rise mb-6 flex items-start justify-between gap-4 rounded-2xl px-5 py-4 text-sm ${
        notice === "ok" ? "bg-sage-soft text-ink" : "border border-clay/30 bg-clay-soft text-clay-dark"
      }`}
    >
      <span>
        {notice === "ok" ? (
          <>
            <b className="text-sage">¡Listo{email ? `, entraste como ${email}` : ""}!</b> Este navegador te va a recordar. Lo que estabas armando sigue acá.
          </>
        ) : (
          MESSAGES[notice as Exclude<Notice, "ok">]
        )}
      </span>
      <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="shrink-0 text-muted hover:text-ink">
        ✕
      </button>
    </div>
  );
}
