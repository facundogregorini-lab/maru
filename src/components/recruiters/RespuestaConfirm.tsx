"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

const TEXTOS = {
  si: { titulo: "¿Te interesa la propuesta?", boton: "Sí, me interesa", listo: "¡Listo! Le avisamos a la empresa, que ya puede ver tu email para escribirte." },
  no: { titulo: "¿No te interesa por ahora?", boton: "No, gracias", listo: "Listo. No vas a recibir más mensajes de esta búsqueda." },
  baja: { titulo: "¿No querés recibir mensajes de empresas por Maru?", boton: "No quiero recibir más", listo: "Listo. No te van a llegar más mensajes de empresas por Maru y tu perfil dejó de aparecer en sus búsquedas." },
} as const;

/** Confirmación de la respuesta del mail: hace falta un clic de la persona (los antivirus abren los links solos). */
export default function RespuestaConfirm() {
  const q = useSearchParams();
  const t = q.get("t") ?? "";
  const r = (["si", "no", "baja"] as const).find((x) => x === q.get("r")) ?? "si";
  const [estado, setEstado] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const txt = TEXTOS[r];

  async function enviar() {
    setEstado("busy");
    const res = await fetch("/api/recruiters/respuesta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, r }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) return setEstado("ok");
    setError((d as { error?: string }).error ?? "No pudimos guardar tu respuesta. Probá en un momento.");
    setEstado("error");
  }

  if (!t) return <p className="text-base">El link no es válido.</p>;
  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-white p-8 shadow-[var(--shadow-soft)]">
      <h1 className="font-display text-3xl">{estado === "ok" ? "Gracias" : txt.titulo}</h1>
      {estado === "ok" ? (
        <p className="text-base leading-relaxed">{txt.listo}</p>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">Tu respuesta le llega a la empresa que te escribió por Maru Recruiters.</p>
          <button type="button" onClick={() => void enviar()} disabled={estado === "busy"} className="press inline-flex min-h-12 items-center justify-center self-start rounded-full bg-neon px-6 text-[15px] font-semibold disabled:opacity-60">
            {estado === "busy" ? "Guardando…" : txt.boton}
          </button>
          {estado === "error" && <p role="alert" className="text-sm text-danger-dark">{error}</p>}
        </>
      )}
    </section>
  );
}
