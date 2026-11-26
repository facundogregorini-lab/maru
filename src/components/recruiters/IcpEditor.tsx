"use client";

import { useEffect, useMemo, useState } from "react";
import { editable, icpActual, type Snapshot } from "@/lib/recruiters/client";
import type { Criterio, IcpEdit, Item, Origen } from "@/lib/recruiters/types";

const ORIGEN: Record<Origen, string> = { brief: "De tu brief", aviso: "Del aviso", referencia: "Del CV de referencia", ajuste: "Ajuste", manual: "Agregado por vos" };
let seq = 0;
const nuevoId = () => `nuevo-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export default function IcpEditor({
  snap,
  busy,
  onSave,
  onApprove,
  onAnswer,
  onCancel,
}: {
  snap: Snapshot;
  busy: boolean;
  onSave: (icp: IcpEdit) => Promise<void>;
  onApprove: (icp: IcpEdit, dirty: boolean) => Promise<void>;
  onAnswer: (preguntaId: string, respuesta: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const b = snap.busqueda;
  const icp = icpActual(b);
  const base = useMemo(() => editable(icp), [icp]);
  const [draft, setDraft] = useState<IcpEdit>(base);
  useEffect(() => setDraft(base), [base]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base);
  const [otra, setOtra] = useState<Record<string, string>>({});

  const setObl = (i: number, patch: Partial<Criterio>) => setDraft((d) => ({ ...d, obligatorios: d.obligatorios.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setItem = (k: "deseables" | "evitar", i: number, texto: string) => setDraft((d) => ({ ...d, [k]: d[k].map((c, j) => (j === i ? { ...c, texto } : c)) }));
  const delItem = (k: "deseables" | "evitar" | "obligatorios", i: number) => setDraft((d) => ({ ...d, [k]: (d[k] as unknown[]).filter((_, j) => j !== i) }));
  const addItem = (k: "deseables" | "evitar") => setDraft((d) => ({ ...d, [k]: [...d[k], { id: nuevoId(), texto: "" } satisfies Item] }));
  const clean = (d: IcpEdit): IcpEdit => ({
    ...d,
    obligatorios: d.obligatorios.filter((c) => c.texto.trim()),
    deseables: d.deseables.filter((c) => c.texto.trim()),
    evitar: d.evitar.filter((c) => c.texto.trim()),
    referencias: d.referencias.map((r) => r.trim()).filter(Boolean),
  });
  const valid = clean(draft).obligatorios.length > 0;

  const lista = (k: "deseables" | "evitar", titulo: string, tono: string) => (
    <div className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-white p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {draft[k].map((c, i) => (
        <div key={c.id} className="flex items-center gap-2">
          <input aria-label={`${titulo} ${i + 1}`} value={c.texto} maxLength={300} onChange={(e) => setItem(k, i, e.target.value)} className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm ${tono}`} />
          <button type="button" onClick={() => delItem(k, i)} aria-label="Quitar" className="h-9 w-9 shrink-0 rounded-lg text-lg text-muted hover:bg-surface">×</button>
        </div>
      ))}
      <button type="button" onClick={() => addItem(k)} className="self-start rounded-full border border-dashed border-black/25 px-3 py-1.5 text-[13px] font-medium">+ Agregar</button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="self-start rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-[#0b4a2a]">Perfil v{icp.version}{b.borrador ? " · borrador" : ""}</span>
          <h1 className="font-display text-[30px] leading-tight">Revisá el perfil ideal</h1>
          <p className="text-[15px] leading-relaxed text-muted">Editá cualquier criterio. Los excluyentes son requisitos firmes; los importantes suman. Nadie queda afuera solo: vos decidís.</p>
        </div>

        <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">Obligatorios</h2>
            <span className="text-xs text-muted">Tocá el peso para cambiarlo</span>
          </div>
          {draft.obligatorios.map((c, i) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line p-3">
              <input aria-label={`Obligatorio ${i + 1}`} value={c.texto} maxLength={300} onChange={(e) => setObl(i, { texto: e.target.value })} className="min-w-[200px] flex-1 rounded-lg px-2 py-1.5 text-sm" />
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">{ORIGEN[c.origen]}</span>
              <button
                type="button"
                onClick={() => setObl(i, { peso: c.peso === "excluyente" ? "importante" : "excluyente" })}
                className={`min-h-8 rounded-full px-3 text-xs font-semibold ${c.peso === "excluyente" ? "bg-ink text-white" : "border border-black/30 bg-white"}`}
              >
                {c.peso === "excluyente" ? "Excluyente" : "Importante"}
              </button>
              <button type="button" onClick={() => delItem("obligatorios", i)} aria-label="Quitar criterio" className="h-8 w-8 rounded-lg text-lg text-muted hover:bg-surface">×</button>
            </div>
          ))}
          {draft.obligatorios.length < 8 && (
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, obligatorios: [...d.obligatorios, { id: nuevoId(), texto: "", peso: "importante", origen: "manual" }] }))}
              className="self-start rounded-full border border-dashed border-black/25 px-3 py-1.5 text-[13px] font-medium"
            >
              + Agregar requisito
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {lista("deseables", "Deseables", "bg-surface-5")}
          {lista("evitar", "Perfiles a evitar", "bg-[#fff3f1]")}
        </div>

        <div className="grid gap-3 rounded-[20px] border border-line bg-white p-5 md:grid-cols-3">
          <label className="grid gap-1 text-[13px] font-semibold md:col-span-3">
            Industrias o empresas de referencia (separadas por coma)
            <input value={draft.referencias.join(", ")} onChange={(e) => setDraft((d) => ({ ...d, referencias: e.target.value.split(",").map((s) => s.trimStart()).slice(0, 10) }))} className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Puesto
            <input value={draft.puesto} maxLength={200} onChange={(e) => setDraft((d) => ({ ...d, puesto: e.target.value }))} className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Seniority
            <input value={draft.seniority} maxLength={120} onChange={(e) => setDraft((d) => ({ ...d, seniority: e.target.value }))} className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Ubicación y modalidad
            <input value={draft.ubicacion} maxLength={200} onChange={(e) => setDraft((d) => ({ ...d, ubicacion: e.target.value }))} className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-[13px] text-muted">Cada versión se guarda con sus resultados para comparar después.</span>
          <div className="flex flex-wrap gap-2.5">
            {onCancel && (
              <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center rounded-full border border-line bg-white px-5 text-[15px] font-medium">
                Volver a los resultados
              </button>
            )}
            {dirty && (
              <button type="button" disabled={busy || !valid} onClick={() => void onSave(clean(draft))} className="inline-flex min-h-12 items-center rounded-full border border-line bg-white px-5 text-[15px] font-medium disabled:opacity-60">
                Guardar cambios
              </button>
            )}
            <button type="button" disabled={busy || !valid} onClick={() => void onApprove(clean(draft), dirty)} className="press inline-flex min-h-12 items-center rounded-full bg-neon px-6 text-[15px] font-semibold disabled:opacity-60">
              {busy ? "Guardando…" : "Aprobar y buscar"}
            </button>
          </div>
        </div>
      </section>

      <aside aria-label="Asistente" className="flex w-full max-w-[400px] flex-[1_1_340px] flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-neon text-[13px] font-bold" aria-hidden>m</span>
          <span className="text-sm font-semibold">Maru</span>
        </div>
        <p className="rounded-2xl bg-surface px-3.5 py-3 text-sm leading-relaxed">{icp.resumen || "Armé el perfil con tu brief."}</p>
        {b.preguntas.length > 0 ? (
          b.preguntas.map((p) => (
            <div key={p.id} className="flex flex-col gap-2.5 rounded-2xl border border-line p-3.5">
              <span className="text-sm leading-relaxed">{p.texto}</span>
              <div className="flex flex-wrap gap-2">
                {p.opciones.map((o) => (
                  <button key={o} type="button" disabled={busy} onClick={() => void onAnswer(p.id, o)} className="min-h-9 rounded-full border border-line bg-white px-3.5 text-[13px] font-medium hover:border-black/30 disabled:opacity-60">
                    {o}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (otra[p.id] ?? "").trim();
                  if (v) void onAnswer(p.id, v);
                }}
                className="flex gap-2"
              >
                <input aria-label="Otra respuesta" placeholder="Otra respuesta" value={otra[p.id] ?? ""} maxLength={300} onChange={(e) => setOtra((o) => ({ ...o, [p.id]: e.target.value }))} className="min-w-0 flex-1 rounded-full border border-line px-3.5 py-2 text-sm" />
                <button type="submit" disabled={busy} className="rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">Enviar</button>
              </form>
            </div>
          ))
        ) : (
          <p className="text-[13px] leading-relaxed text-muted">Si algo no te cierra, editalo a la izquierda. Cuando apruebes, Maru lee cada CV contra este perfil.</p>
        )}
        {dirty && b.preguntas.length > 0 && <p className="text-xs text-muted">Responder una pregunta reescribe el perfil: guardá antes tus cambios a mano.</p>}
      </aside>
    </div>
  );
}
