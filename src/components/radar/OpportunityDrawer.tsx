"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { handoffJob, type HandoffTarget } from "@/lib/match/clientStore";
import { CRITERIA, ELIGIBILITY_LABEL } from "@/lib/radar/match/score";
import type { JobOpening, Priority, RadarMatch } from "@/lib/radar/types";
import { STATUSES, type TrackItem } from "@/lib/tracker";
import { radarApi } from "./api";
import { REMOTE_LABEL, ago, fmtDate } from "./bits";
import { Drawer, Notice, PriorityPill, Tag, btnDark, btnGhost, btnNeon } from "./ui";

export type DetectedJob = JobOpening & {
  companyName: string;
  priority: Priority | null;
  industries: string[];
  match: RadarMatch | null;
  action: { value: number; band: "alta" | "media" | "baja"; why: string[] } | null;
};

export const ELIG_TONE = { eligible: "ok", needs_verification: "warn", blocked: "danger" } as const;
const MUST: Record<string, string> = { cumple: "✓", no_cumple: "✗", desconocido: "?" };
const MUST_LABEL: Record<string, string> = { cumple: "Lo cumplís", no_cumple: "No se ve en tu CV", desconocido: "Sin dato" };

/** Detalle de una oportunidad: desglose con evidencia, excluyentes, desconocidos y próximos pasos. */
export default function OpportunityDrawer({
  job: j,
  tracked,
  onClose,
  onSave,
  onDismiss,
}: {
  job: DetectedJob;
  tracked: TrackItem | null;
  onClose: () => void;
  onSave: () => void;
  onDismiss: (undo: boolean) => Promise<void>;
}) {
  const router = useRouter();
  const [going, setGoing] = useState<HandoffTarget | null>(null);
  const [error, setError] = useState("");
  const m = j.match;
  const dismissed = m?.disposition === "dismissed";

  async function open(to: HandoffTarget) {
    setGoing(to);
    setError("");
    try {
      const d = await radarApi<{ id: string; title: string; company: string; url: string; text: string }>(`/api/radar/oportunidades/vacante?companyId=${encodeURIComponent(j.companyId)}&jobId=${j.id}`);
      handoffJob(to, { id: tracked?.id, jobUrl: d.url, jobText: d.text, title: d.title, company: d.company });
      router.push(`/${to}#empezar`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir la herramienta.");
      setGoing(null);
    }
  }

  return (
    <Drawer title={j.title} open onClose={onClose} wide>
      <p className="text-sm text-muted">
        {j.companyName} · {[j.location, REMOTE_LABEL[j.remoteType]].filter(Boolean).join(" · ") || "Ubicación sin dato"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <PriorityPill p={j.priority} />
        <Tag>{j.publishedAt ? `Publicada ${fmtDate(j.publishedAt)}` : "Sin fecha de publicación"}</Tag>
        <Tag>Detectada {ago(j.firstSeenAt)}</Tag>
        {m?.rejected ? <Tag tone="danger">No encaja</Tag> : m && <Tag tone={ELIG_TONE[m.eligibility]}>{ELIGIBILITY_LABEL[m.eligibility]}</Tag>}
        {tracked && <Tag tone="ok">En Seguimiento: {STATUSES.find((s) => s.id === tracked.status)?.one}</Tag>}
      </div>

      {!m || m.score === null ? (
        <div className="mt-4"><Notice>Todavía sin evaluar con tu perfil. Tocá «Evaluar con mi perfil» en Oportunidades.</Notice></div>
      ) : (
        <>
          {m.stale && <div className="mt-4"><Notice tone="warn">Evaluación desactualizada: cambió tu perfil o el aviso. Volvé a evaluar para actualizarla.</Notice></div>}
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Match</p>
              <p className="text-4xl font-extrabold">{m.score}<span className="text-lg text-muted">/100</span></p>
            </div>
            <div className="pb-1 text-sm">
              <p>Confianza {m.confidence} · Cobertura {Math.round(m.coverage * 100)} %</p>
              <p className="text-xs text-muted">{m.method === "ia" ? "Evaluado con IA y reglas" : "Evaluado sólo con reglas"} · {ago(m.evaluatedAt)}. No es una probabilidad de contratación.</p>
            </div>
            {j.action && (
              <div className="pb-1 text-sm">
                <p className="font-semibold">Prioridad de acción: {j.action.band}</p>
                <p className="text-xs text-muted">{j.action.why.join(" · ")}</p>
              </div>
            )}
          </div>
          {m.mainReason && <p className="mt-4 text-base">{m.mainReason}</p>}
          {m.mainBarrier && <p className="mt-2 text-sm"><b>Barrera principal:</b> {m.mainBarrier}</p>}

          {m.rejected && (
            <div className="mt-4">
              <Notice tone="warn"><b>No encaja con tu perfil:</b> {m.rejected}. Por eso no se recomienda y su puntaje queda bajo.</Notice>
            </div>
          )}
          {m.eligibility !== "eligible" && (
            <div className="mt-4">
              <Notice tone={m.eligibility === "blocked" ? "error" : "warn"}>
                <b>{m.eligibility === "blocked" ? "Bloqueada: un requisito excluyente no se cumple." : "Por verificar antes de postularte."}</b> {m.eligibilityEvidence.join(" ")}
                {m.eligibility === "blocked" && " Un score alto no compensa un bloqueo."}
              </Notice>
            </div>
          )}

          <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Desglose</h3>
          <ul className="mt-2 space-y-2">
            {m.breakdown.map((c) => (
              <li key={c.id} className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{CRITERIA.find((x) => x.id === c.id)?.label}</span>
                  <span className="text-xs text-muted">peso {c.weight}</span>
                  <span className="ml-auto font-bold">{c.known ? `${c.score}/100` : "Sin dato"}</span>
                </div>
                {c.known && (
                  <div className="mt-1 h-1.5 rounded-full bg-surface" aria-hidden>
                    <div className="h-1.5 rounded-full bg-forest" style={{ width: `${c.score}%` }} />
                  </div>
                )}
                {c.evidence.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-muted">{c.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {m.strengths.length > 0 && (
              <section>
                <h3 className="text-sm font-bold">Fortalezas</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">{m.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </section>
            )}
            {m.gaps.length > 0 && (
              <section>
                <h3 className="text-sm font-bold">Brechas</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">{m.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </section>
            )}
          </div>
          {m.mustHaves.length > 0 && (
            <section className="mt-4">
              <h3 className="text-sm font-bold">Requisitos excluyentes del aviso</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {m.mustHaves.map((x, i) => (
                  <li key={i}>
                    <span aria-hidden className="mr-1 font-bold">{MUST[x.status]}</span>
                    {x.text} <span className="text-xs text-muted">({MUST_LABEL[x.status]})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {m.unknowns.length > 0 && (
            <section className="mt-4">
              <h3 className="text-sm font-bold">Lo que no sabemos</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted">{m.unknowns.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}
          {m.nextStep && <p className="mt-4 text-sm"><b>Siguiente paso:</b> {m.nextStep}</p>}
        </>
      )}

      {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
      <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap gap-2 border-t border-line bg-white px-5 py-4">
        <button type="button" className={btnNeon} onClick={onSave}>{tracked ? "Guardada en Seguimiento" : "Guardar"}</button>
        <button type="button" className={btnDark} disabled={going !== null} onClick={() => void open("postulacion")}>{going === "postulacion" ? "Abriendo…" : "Adaptar CV"}</button>
        <button type="button" className={btnGhost} disabled={going !== null} onClick={() => void open("carta")}>Carta</button>
        <button type="button" className={btnGhost} disabled={going !== null} onClick={() => void open("entrevista")}>Entrevista</button>
        <a href={j.url?.startsWith("https://") ? j.url : undefined} target="_blank" rel="noopener noreferrer" className={btnGhost}>Ver aviso original <span aria-hidden>↗</span></a>
        <button type="button" className={`${btnGhost} ml-auto`} onClick={() => void onDismiss(dismissed)}>{dismissed ? "Volver a mostrar" : "Descartar"}</button>
      </div>
      <p className="mt-2 text-xs text-muted">Maru nunca se postula por vos: guardar crea una tarjeta en Seguimiento y la postulación la hacés vos.</p>
    </Drawer>
  );
}
