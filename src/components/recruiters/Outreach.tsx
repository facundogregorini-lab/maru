"use client";

import { useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/lib/recruiters/client";
import type { Canal, EstadoInscripcion, Paso, SecuenciaEdit } from "@/lib/recruiters/types";

type Act = (body: Record<string, unknown>) => Promise<Snapshot>;

const CANAL: Record<Canal, string> = { email: "Email", whatsapp: "WhatsApp", linkedin: "LinkedIn" };
const ESTADO: Record<EstadoInscripcion, { label: string; cls: string }> = {
  activa: { label: "En curso", cls: "bg-panel text-[#0b4a2a]" },
  pausada: { label: "En pausa", cls: "bg-surface text-muted" },
  tarea: { label: "Tarea pendiente", cls: "bg-warning-soft text-ink" },
  interesado: { label: "Le interesa", cls: "bg-neon text-ink" },
  no_interesado: { label: "No le interesa", cls: "bg-surface text-muted" },
  respondio: { label: "Respondió", cls: "bg-neon/40 text-ink" },
  completada: { label: "Secuencia terminada", cls: "bg-surface text-muted" },
  cancelada: { label: "Cancelada", cls: "bg-surface text-muted" },
  baja: { label: "Pidió no recibir más", cls: "bg-danger-soft text-danger-dark" },
};
let seq = 0;
const pasoId = () => `p-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const fecha = (t: number) => (t ? new Date(t).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }) : "");

const BLANCO = (): Paso[] => [
  { id: pasoId(), canal: "email", dias: 0, asunto: "{{puesto}} en {{empresa}}", cuerpo: "Hola {{nombre}},\n\n{{gancho}}\n\nEstoy buscando {{puesto}} para {{empresa}} y tu experiencia encaja con lo que necesitamos. ¿Te sumás a una charla de 20 minutos esta semana?\n\nSaludos,\n{{remitente}}" },
  { id: pasoId(), canal: "whatsapp", dias: 3, asunto: "", cuerpo: "Hola {{nombre}}, soy {{remitente}} de {{empresa}}. Te escribí por mail por una búsqueda de {{puesto}}. ¿Tenés 20 minutos para charlar?" },
  { id: pasoId(), canal: "email", dias: 4, asunto: "", cuerpo: "Hola {{nombre}}, te escribo de nuevo por la búsqueda de {{puesto}}. Si no es tu momento, no hay problema; si te interesa, respondé este mail y coordinamos.\n\n{{remitente}}" },
];

export default function Outreach({ snap, act }: { snap: Snapshot; act: Act }) {
  const o = snap.outreach;
  const base = useMemo<SecuenciaEdit | null>(() => (o.secuencia ? { pasos: o.secuencia.pasos, remitente: o.secuencia.remitente, empresa: o.secuencia.empresa, autoSi: o.secuencia.autoSi } : null), [o.secuencia]);
  const [draft, setDraft] = useState<SecuenciaEdit | null>(base);
  useEffect(() => setDraft(base), [base]);
  const [tono, setTono] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(base);

  async function run(label: string, body: Record<string, unknown>) {
    setBusy(label);
    setError("");
    try {
      await act(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setBusy("");
    }
  }

  const byId = new Map(snap.candidatos.map((c) => [c.id, c]));
  const inscriptos = new Set(o.inscripciones.filter((i) => i.estado !== "cancelada").map((i) => i.candidatoId));
  const siSinInscribir = snap.candidatos.filter((c) => c.decision === "si" && !inscriptos.has(c.id));
  const tareas = o.inscripciones.filter((i) => i.tarea);
  const setPaso = (i: number, patch: Partial<Paso>) => setDraft((d) => (d ? { ...d, pasos: d.pasos.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : d));

  if (!o.secuencia || !draft) {
    return (
      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-6">
        <h2 className="font-display text-2xl">Armá la secuencia de contacto</h2>
        <p className="max-w-[680px] text-sm leading-relaxed text-muted">Una serie de mensajes por email, WhatsApp y LinkedIn con días de espera entre uno y otro. Maru escribe una primera línea distinta para cada candidato con su experiencia. Nada se envía hasta que actives la secuencia.</p>
        <label className="grid max-w-[680px] gap-1 text-[13px] font-semibold">
          Tono o algo que quieras que diga (opcional)
          <input value={tono} maxLength={500} onChange={(e) => setTono(e.target.value)} placeholder="Ej.: cercano, mencionar que el equipo es remoto" className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-dark">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => void run("gen", { accion: "secuencia_generar", ...(tono.trim() ? { tono: tono.trim() } : {}) })} className="press inline-flex min-h-12 items-center rounded-full bg-neon px-6 text-[15px] font-semibold disabled:opacity-60">
            {busy === "gen" ? "Escribiendo…" : "Escribir con Maru"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void run("blank", { accion: "secuencia_guardar", secuencia: { pasos: BLANCO(), remitente: "Tu nombre", empresa: "Tu empresa", autoSi: false } })} className="inline-flex min-h-12 items-center rounded-full border border-line bg-white px-5 text-[15px] font-medium disabled:opacity-60">
            Usar una plantilla
          </button>
        </div>
      </section>
    );
  }

  const activa = o.secuencia.activa;
  return (
    <div className="flex flex-col gap-5">
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-dark">{error}</p>}

      <section className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${activa ? "border border-brand-light bg-panel" : "border border-dashed border-black/20 bg-white"}`}>
        <span className="text-sm leading-relaxed">
          {activa ? "La secuencia está activa: los pasos salen solos en días hábiles, a las 10." : "La secuencia está en pausa: no se envía nada."}
          {!o.configuracion.email && " Los mails todavía no se pueden enviar desde Maru: quedan como tareas."}
          {!o.configuracion.whatsapp && " WhatsApp queda como tarea con el mensaje listo."}
        </span>
        <button type="button" disabled={!!busy || dirty} onClick={() => void run("act", { accion: "secuencia_activar", activa: !activa })} className={`press inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${activa ? "border border-line bg-white" : "bg-neon"}`}>
          {activa ? "Pausar" : "Activar secuencia"}
        </button>
      </section>
      {dirty && <p className="text-xs text-muted">Guardá los cambios antes de activar o pausar.</p>}

      {tareas.length > 0 && (
        <section className="flex flex-col gap-3 rounded-[20px] border border-warning bg-white p-5">
          <h2 className="text-base font-semibold">Tareas para hoy ({tareas.length})</h2>
          {tareas.map((i) => {
            const c = byId.get(i.candidatoId);
            const t = i.tarea!;
            return (
              <div key={i.candidatoId} className="flex flex-col gap-2 rounded-xl bg-surface-5 p-3">
                <span className="text-sm font-semibold">{CANAL[t.canal]} a {c?.nombre}</span>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{t.texto}</p>
                <div className="flex flex-wrap gap-2">
                  {t.whatsapp && <a href={t.whatsapp} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full bg-[#25d366] px-3.5 text-[13px] font-semibold text-ink">Abrir WhatsApp</a>}
                  {t.linkedin && <a href={t.linkedin.startsWith("http") ? t.linkedin : `https://${t.linkedin}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold">Abrir LinkedIn</a>}
                  <button type="button" onClick={() => void navigator.clipboard.writeText(t.texto).then(() => setCopied(i.candidatoId))} className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-medium">
                    {copied === i.candidatoId ? "Copiado" : "Copiar mensaje"}
                  </button>
                  <button type="button" disabled={!!busy} onClick={() => void run(`t${i.candidatoId}`, { accion: "tarea_hecha", candidatoId: i.candidatoId })} className="inline-flex min-h-9 items-center rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">
                    Hecho
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Candidatos en la secuencia</h2>
          {siSinInscribir.length > 0 && (
            <button type="button" disabled={!!busy} onClick={() => void run("ins", { accion: "inscribir", candidatoIds: siSinInscribir.slice(0, 20).map((c) => c.id) })} className="press inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60">
              {busy === "ins" ? "Inscribiendo…" : `Inscribir a los Sí (${siSinInscribir.length})`}
            </button>
          )}
        </div>
        {o.inscripciones.length === 0 ? (
          <p className="text-sm text-muted">Marcá candidatos con Sí y sumalos acá. Los de Maru reciben el mensaje en el email de su cuenta, sin que veas su contacto hasta que respondan.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-surface">
            {o.inscripciones.map((i) => {
              const c = byId.get(i.candidatoId);
              const e = ESTADO[i.estado];
              const total = o.secuencia!.pasos.length;
              return (
                <li key={i.candidatoId} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-[160px] flex-1 text-sm font-semibold">{c?.nombre}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${e.cls}`}>{e.label}</span>
                  <span className="text-xs text-muted">Paso {Math.min(i.paso + 1, total)} de {total}{i.estado === "activa" && i.proximoEn ? ` · próximo ${fecha(i.proximoEn)}` : ""}</span>
                  <span className="ml-auto flex gap-1.5">
                    {(i.estado === "activa" || i.estado === "tarea") && (
                      <button type="button" onClick={() => void run(`p${i.candidatoId}`, { accion: "inscripcion", candidatoId: i.candidatoId, estado: "pausada" })} className="rounded-full border border-line px-3 py-1 text-xs">Pausar</button>
                    )}
                    {i.estado === "pausada" && (
                      <button type="button" onClick={() => void run(`r${i.candidatoId}`, { accion: "inscripcion", candidatoId: i.candidatoId, estado: "activa" })} className="rounded-full border border-line px-3 py-1 text-xs">Reanudar</button>
                    )}
                    {!["respondio", "interesado", "no_interesado", "baja", "cancelada"].includes(i.estado) && (
                      <>
                        <button type="button" onClick={() => void run(`m${i.candidatoId}`, { accion: "inscripcion", candidatoId: i.candidatoId, estado: "respondio" })} className="rounded-full border border-line px-3 py-1 text-xs">Respondió</button>
                        <button type="button" onClick={() => void run(`c${i.candidatoId}`, { accion: "inscripcion", candidatoId: i.candidatoId, estado: "cancelada" })} className="rounded-full border border-line px-3 py-1 text-xs text-muted">Sacar</button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">Si el candidato responde el mail, la respuesta te llega directo a tu casilla: marcalo como «Respondió» para frenar la secuencia. Si toca «Me interesa», se frena solo y te avisamos por mail.</p>
      </section>

      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Secuencia</h2>
          <span className="text-xs text-muted">Variables: {"{{nombre}} {{puesto}} {{empresa}} {{remitente}} {{gancho}}"}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[13px] font-semibold">
            Quién firma
            <input value={draft.remitente} maxLength={80} onChange={(e) => setDraft({ ...draft, remitente: e.target.value })} className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Empresa
            <input value={draft.empresa} maxLength={120} onChange={(e) => setDraft({ ...draft, empresa: e.target.value })} className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
          </label>
        </div>
        {draft.pasos.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-2.5 rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Paso {i + 1}</span>
              <select aria-label="Canal" value={p.canal} onChange={(e) => setPaso(i, { canal: e.target.value as Canal })} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">
                {(Object.keys(CANAL) as Canal[]).map((k) => <option key={k} value={k}>{CANAL[k]}</option>)}
              </select>
              {i > 0 ? (
                <label className="flex items-center gap-1.5 text-sm">
                  <input aria-label="Días después" type="number" min={1} max={30} value={p.dias} onChange={(e) => setPaso(i, { dias: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })} className="w-16 rounded-lg border border-line px-2 py-1.5" />
                  días después
                </label>
              ) : (
                <span className="text-xs text-muted">al inscribir</span>
              )}
              {draft.pasos.length > 1 && (
                <button type="button" onClick={() => setDraft({ ...draft, pasos: draft.pasos.filter((_, j) => j !== i) })} className="ml-auto text-xs text-muted underline">Quitar</button>
              )}
            </div>
            {p.canal === "email" && draft.pasos.findIndex((x) => x.canal === "email") === i && (
              <input aria-label="Asunto" value={p.asunto} maxLength={160} onChange={(e) => setPaso(i, { asunto: e.target.value })} placeholder="Asunto" className="rounded-xl border border-line px-3 py-2 text-sm" />
            )}
            <textarea aria-label={`Mensaje del paso ${i + 1}`} rows={p.canal === "email" ? 7 : 3} value={p.cuerpo} maxLength={3000} onChange={(e) => setPaso(i, { cuerpo: e.target.value })} className="rounded-xl border border-line p-3 text-sm leading-relaxed" />
            {p.canal === "linkedin" && <span className="text-xs text-muted">LinkedIn no se automatiza: te queda como tarea con el mensaje listo.</span>}
          </div>
        ))}
        {draft.pasos.length < 5 && (
          <button type="button" onClick={() => setDraft({ ...draft, pasos: [...draft.pasos, { id: pasoId(), canal: "email", dias: 3, asunto: "", cuerpo: "Hola {{nombre}}," }] })} className="self-start rounded-full border border-dashed border-black/25 px-3 py-1.5 text-[13px] font-medium">
            + Agregar paso
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.autoSi} onChange={(e) => setDraft({ ...draft, autoSi: e.target.checked })} className="h-4 w-4" />
          Inscribir automáticamente a cada candidato que marque con Sí
        </label>
        <p className="text-xs text-muted">Maru agrega solo, al pie de cada mail, los botones «Me interesa» y «No, gracias», el link de privacidad y la opción de no recibir más mensajes.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={!!busy} onClick={() => void run("gen", { accion: "secuencia_generar", ...(tono.trim() ? { tono: tono.trim() } : {}) })} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium disabled:opacity-60">
            {busy === "gen" ? "Escribiendo…" : "Reescribir con Maru"}
          </button>
          <button type="button" disabled={!!busy || !dirty || !draft.remitente.trim() || !draft.empresa.trim() || draft.pasos.some((p) => !p.cuerpo.trim())} onClick={() => void run("save", { accion: "secuencia_guardar", secuencia: draft })} className="press inline-flex min-h-11 items-center rounded-full bg-neon px-5 text-sm font-semibold disabled:opacity-60">
            {busy === "save" ? "Guardando…" : "Guardar secuencia"}
          </button>
        </div>
      </section>
    </div>
  );
}
