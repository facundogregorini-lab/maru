"use client";

import Link from "next/link";
import { useState } from "react";

/** Baja con un botón (no al abrir el link: los antivirus del correo abren los links solos). */
export default function AlertUnsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  if (!token) return <p className="mt-4 text-muted">El link de baja está incompleto. Podés apagar las alertas desde tu match.</p>;
  if (state === "done")
    return (
      <div className="mt-4">
        <p>Listo: no te mandamos más alertas. Podés volver a activarlas cuando quieras desde tu match.</p>
        <Link href="/match" className="press mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
          Ir a mi match
        </Link>
      </div>
    );
  return (
    <div className="mt-4">
      <p className="text-muted">Si no querés recibir más el mail de los lunes con búsquedas para vos, confirmá acá.</p>
      <button
        type="button"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await fetch(`/api/alertas/baja?t=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
          if (res?.ok) return setState("done");
          const d = (await res?.json().catch(() => null)) as { error?: string } | null;
          setError(d?.error ?? "No pudimos darte de baja. Probá en un momento.");
          setState("error");
        }}
        className="press mt-6 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === "busy" ? "Dando de baja…" : "Dejar de recibir alertas"}
      </button>
      {state === "error" && <p role="alert" className="mt-3 text-sm text-danger-dark">{error}</p>}
    </div>
  );
}
