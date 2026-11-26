"use client";

import { useState } from "react";
import type { Propuesta } from "@/lib/recruiters/types";

const TIPO: Record<Propuesta["tipo"], string> = {
  agregar_obligatorio: "Requisito nuevo",
  quitar_obligatorio: "Quitar requisito",
  cambiar_peso: "Cambiar el peso",
  editar_obligatorio: "Reescribir requisito",
  agregar_deseable: "Deseable nuevo",
  agregar_evitar: "Perfil a evitar",
};

export default function Afinar({ propuestas, version, busy, onApply, onClose }: { propuestas: Propuesta[]; version: number; busy: boolean; onApply: (aceptadas: string[]) => Promise<void>; onClose: () => void }) {
  const [dec, setDec] = useState<Record<string, "on" | "off" | undefined>>({});
  const aceptadas = propuestas.filter((p) => dec[p.id] === "on").map((p) => p.id);
  const set = (id: string, v: "on" | "off") => setDec((d) => ({ ...d, [id]: d[id] === v ? undefined : v }));
  const despues = (p: Propuesta) => (p.tipo === "quitar_obligatorio" ? "Se quita del perfil" : p.tipo === "cambiar_peso" ? (p.peso === "excluyente" ? "Pasa a excluyente" : "Pasa a importante") : p.despues);

  return (
    <section aria-label="Ajustes propuestos" className="flex flex-col gap-4 rounded-[20px] border-2 border-neon-deep bg-[#f4fff9] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="self-start rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-[#0b4a2a]">Perfil v{version} → v{version + 1}</span>
          <h2 className="font-display text-2xl">{propuestas.length ? `Maru te propone ${propuestas.length} ${propuestas.length === 1 ? "ajuste" : "ajustes"}` : "Sin ajustes por ahora"}</h2>
          <p className="max-w-[640px] text-sm text-muted">{propuestas.length ? "Salen de tus calificaciones y sus motivos. Aceptá los que tengan sentido; nada cambia hasta que apliques." : "Tus calificaciones no muestran un patrón claro todavía. Seguí calificando y volvé a pedirlos."}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium">Cerrar</button>
      </div>
      {propuestas.map((p) => (
        <article key={p.id} className={`flex flex-col gap-3 rounded-[18px] bg-white p-4 ${dec[p.id] === "on" ? "border-2 border-neon-deep" : dec[p.id] === "off" ? "border border-line opacity-60" : "border border-line"}`}>
          <span className="text-xs font-semibold text-muted">{TIPO[p.tipo]}</span>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-xl bg-surface-5 p-3">
              <span className="text-[11px] font-semibold text-muted">ANTES</span>
              <span className="text-sm text-muted">{p.antes || "No estaba en el perfil"}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl bg-panel p-3">
              <span className="text-[11px] font-semibold text-[#0b4a2a]">DESPUÉS</span>
              <span className="text-sm">{despues(p)}</span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed"><span className="font-semibold">Por qué:</span> {p.porQue}</p>
          <div className="flex gap-2">
            <button type="button" aria-pressed={dec[p.id] === "on"} onClick={() => set(p.id, "on")} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${dec[p.id] === "on" ? "border-neon-deep bg-neon" : "border-black/20 bg-white"}`}>
              {dec[p.id] === "on" ? "✓ Aceptado" : "Aceptar"}
            </button>
            <button type="button" aria-pressed={dec[p.id] === "off"} onClick={() => set(p.id, "off")} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${dec[p.id] === "off" ? "border-ink bg-ink text-white" : "border-black/20 bg-white"}`}>
              Descartar
            </button>
          </div>
        </article>
      ))}
      {propuestas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-muted">Al aplicar, Maru reevalúa los candidatos con la versión nueva. Tus calificaciones se mantienen.</span>
          <button type="button" disabled={busy || !aceptadas.length} onClick={() => void onApply(aceptadas)} className="press inline-flex min-h-12 items-center rounded-full bg-neon px-6 text-[15px] font-semibold disabled:opacity-60">
            Aplicar {aceptadas.length || ""} y reevaluar
          </button>
        </div>
      )}
    </section>
  );
}
