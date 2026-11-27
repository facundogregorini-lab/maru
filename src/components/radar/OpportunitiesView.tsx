"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestLogin } from "@/lib/loginRequest";
import { fold } from "@/lib/radar/identity";
import { ELIGIBILITY_LABEL } from "@/lib/radar/match/score";
import { trackInputFor, trackedFor } from "@/lib/radar/tracking";
import type { PilotJob } from "@/lib/radar/types";
import { STATUSES, TRACKER_EVENT, listTracked, upsertTracked, type TrackItem } from "@/lib/tracker";
import { scoreBand, trackRadar } from "@/lib/radar/analytics";
import { radarApi } from "./api";
import { REMOTE_LABEL, ago, fmtDate } from "./bits";
import AlertsPanel from "./AlertsPanel";
import OpportunityDrawer, { ELIG_TONE, type DetectedJob } from "./OpportunityDrawer";
import { EmptyState, Monogram, Notice, PriorityPill, Skeleton, Stat, Tag, btnDark, btnGhost, btnNeon, card, field, useToast } from "./ui";

type Data = {
  jobs: DetectedJob[];
  pilot: PilotJob[];
  companies: { total: number; checked: number; lastSuccessAt: string | null };
  recentlyClosed: { id: string; title: string; companyName: string; url: string; closedAt: string | null }[];
};
type EvalResult = { total: number; unchanged: number; rules: number; ia: number; failed: number; pendingIa: number; staleKept: number; quotaLeft: number | null };

const LAST_VISIT = "maru:radar:ultima-visita";
const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

type Filters = { view: "todas" | "nuevas"; industry: string; priority: string; q: string; remote: boolean; minScore: number; state: "activas" | "por_verificar" | "bloqueadas" | "no_encajan" | "guardadas" | "descartadas" | "sin_evaluar"; sort: "accion" | "match" | "novedad" };
const DEFAULT: Filters = { view: "todas", industry: "Todas", priority: "Todas", q: "", remote: false, minScore: 0, state: "activas", sort: "accion" };

/** Oportunidades: vacantes reales de las empresas que seguís, con su match, gates y prioridad de acción. */
export default function OpportunitiesView() {
  const { email } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [since, setSince] = useState<string | null>(null);
  const [f, setF] = useState<Filters>(DEFAULT);
  const [tracker, setTracker] = useState<TrackItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalMsg, setEvalMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setData(await radarApi<Data>("/api/radar/oportunidades"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar las oportunidades.");
    }
  }, []);

  useEffect(() => {
    if (!email) return;
    setSince(safeGet(LAST_VISIT));
    void load().then(() => {
      try {
        localStorage.setItem(LAST_VISIT, new Date().toISOString());
      } catch {
        // sin almacenamiento: "nuevas" cuenta desde siempre
      }
    });
  }, [email, load]);

  // Seguimiento vive en el navegador (y en la cuenta): se relee cuando cambia en cualquier pestaña.
  useEffect(() => {
    const read = () => setTracker(listTracked());
    read();
    window.addEventListener(TRACKER_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(TRACKER_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const isNew = useCallback((j: DetectedJob) => !since || j.firstSeenAt > since, [since]);
  const trackedOf = useCallback((j: DetectedJob) => trackedFor(tracker, { url: j.url, title: j.title, companyName: j.companyName }), [tracker]);

  const industries = useMemo(() => [...new Set((data?.jobs ?? []).flatMap((j) => j.industries))].sort((a, b) => a.localeCompare(b, "es")), [data]);
  const shown = useMemo(() => {
    const q = fold(f.q);
    const list = (data?.jobs ?? []).filter((j) => {
      const m = j.match;
      const dismissed = m?.disposition === "dismissed";
      const tracked = !!trackedOf(j);
      if (f.state === "descartadas") { if (!dismissed) return false; }
      else if (dismissed) return false;
      if (f.state === "activas" && (m?.eligibility === "blocked" || m?.rejected)) return false;
      if (f.state === "no_encajan" && !m?.rejected) return false;
      if (f.state === "bloqueadas" && m?.eligibility !== "blocked") return false;
      if (f.state === "por_verificar" && (m?.eligibility !== "needs_verification" || m?.rejected)) return false;
      if (f.state === "guardadas" && !tracked) return false;
      if (f.state === "sin_evaluar" && m && m.score !== null) return false;
      if (f.minScore && (m?.score ?? -1) < f.minScore) return false;
      if (f.view === "nuevas" && !isNew(j)) return false;
      if (f.industry !== "Todas" && !j.industries.includes(f.industry)) return false;
      if (f.priority !== "Todas" && (f.priority === "sin" ? j.priority : j.priority !== f.priority)) return false;
      if (f.remote && j.remoteType !== "remoto") return false;
      if (q && !fold(`${j.title} ${j.companyName} ${j.location}`).includes(q)) return false;
      return true;
    });
    const recent = (j: DetectedJob) => j.publishedAt ?? j.firstSeenAt;
    if (f.sort === "match") list.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
    else if (f.sort === "novedad") list.sort((a, b) => recent(b).localeCompare(recent(a)));
    return list; // "accion": ya viene ordenado del servidor
  }, [data, f, isNew, trackedOf]);

  async function evaluate() {
    setEvaluating(true);
    setEvalMsg(null);
    try {
      const { result: r } = await radarApi<{ result: EvalResult }>("/api/radar/oportunidades/evaluar", { method: "POST" });
      const parts = [`${r.ia} evaluadas con IA`, `${r.rules} descartadas por reglas`, `${r.unchanged} sin cambios`];
      if (r.pendingIa) parts.push(`${r.pendingIa} quedan para la próxima${r.quotaLeft === 0 ? " (llegaste al cupo de hoy)" : ""}`);
      if (r.failed) parts.push(`${r.failed} no se pudieron evaluar`);
      setEvalMsg({ text: `Listo: ${parts.join(", ")}.`, tone: r.failed ? "error" : "info" });
      await load();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setEvalMsg({ text: code === "NO_PROFILE" ? "Para evaluar, Maru necesita tu CV: cargalo en Match (con tu cuenta) y volvé." : e instanceof Error ? e.message : "No se pudo evaluar.", tone: "error" });
    } finally {
      setEvaluating(false);
    }
  }

  function save(j: DetectedJob) {
    const existed = !!trackedOf(j);
    const item = upsertTracked(trackInputFor({ url: j.url, title: j.title, companyName: j.companyName }));
    const props = { company_id: j.companyId, job_id: j.id, priority: j.priority ?? "sin", score_band: scoreBand(j.match?.score), sector: j.industries[0] };
    trackRadar("radar_opportunity_saved", props);
    if (item && !existed) trackRadar("radar_application_created", { ...props, status: item.status });
    if (item) toast.show(item.status === "guardada" ? "Guardada en Seguimiento" : `Ya está en Seguimiento (${STATUSES.find((s) => s.id === item.status)?.one})`);
  }

  async function dismiss(j: DetectedJob, undo: boolean) {
    try {
      await radarApi("/api/radar/oportunidades/descartar", { method: "POST", body: { companyId: j.companyId, jobId: j.id, undo } });
      if (!undo) trackRadar("radar_opportunity_dismissed", { company_id: j.companyId, job_id: j.id, score_band: scoreBand(j.match?.score) });
      toast.show(undo ? "Vuelve a aparecer en la lista" : "Descartada: no se borra la vacante, sólo deja de mostrarse");
      setOpenId(null);
      await load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "No se pudo.", "error");
    }
  }

  if (email === undefined) return <Skeleton />;
  if (email === null)
    return <EmptyState title="Ingresá para ver tus oportunidades" actions={<button type="button" className={btnDark} onClick={() => void requestLogin("usar Radar laboral")}>Ingresar con Google</button>} />;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Skeleton />;

  const visible = data.jobs.filter((j) => j.match?.disposition !== "dismissed");
  const newCount = visible.filter(isNew).length;
  const high = visible.filter((j) => j.action?.band === "alta").length;
  const unevaluated = visible.filter((j) => !j.match || j.match.score === null).length;
  const closedTracked = data.recentlyClosed.filter((c) => trackedFor(tracker, { url: c.url, title: c.title, companyName: c.companyName }));
  const openJob = openId ? data.jobs.find((j) => j.id === openId) ?? null : null;
  const openDetail = (j: DetectedJob) => {
    setOpenId(j.id);
    trackRadar("radar_opportunity_viewed", { company_id: j.companyId, job_id: j.id, score_band: scoreBand(j.match?.score), priority: j.priority ?? "sin" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nuevas" value={newCount} hint={since ? `Desde tu última visita (${ago(since)})` : "Primera visita"} />
        <Stat label="Prioridad alta" value={high} hint={unevaluated ? `${unevaluated} sin evaluar` : "Todas evaluadas"} />
        <Stat label="Empresas revisadas" value={`${data.companies.checked}/${data.companies.total}`} hint="Con al menos una lectura buena" />
        <Stat label="Última actualización" value={data.companies.lastSuccessAt ? ago(data.companies.lastSuccessAt) : "—"} hint={data.companies.lastSuccessAt ? fmtDate(data.companies.lastSuccessAt) : "Sin revisiones"} />
      </div>

      <AlertsPanel />

      {closedTracked.length > 0 && (
        <Notice tone="warn">
          {closedTracked.length === 1 ? "Una vacante que guardaste cerró" : `${closedTracked.length} vacantes que guardaste cerraron`} en su fuente oficial: {closedTracked.map((c) => `${c.companyName} · ${c.title}`).join("; ")}. Tus tarjetas en Seguimiento siguen igual.
        </Notice>
      )}

      {data.jobs.length === 0 ? (
        <EmptyState title={data.companies.checked ? "No hay vacantes abiertas en tus empresas" : "Todavía no hay fuentes verificadas"} actions={<Link href="/radar/empresas" className={btnDark}>Ir a Mis empresas</Link>}>
          <p>{data.companies.checked ? "Maru leyó sus páginas y no encontró avisos publicados." : "Abrí la ficha de una empresa y tocá «Revisar ahora» para leer su página de Careers."}</p>
        </EmptyState>
      ) : (
        <section className={`${card} p-4 sm:p-5`} aria-labelledby="ops-titulo">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ops-titulo" className="mr-auto text-lg font-bold">Oportunidades</h2>
            <button type="button" className={btnNeon} disabled={evaluating} onClick={() => void evaluate()}>{evaluating ? "Evaluando…" : "Evaluar con mi perfil"}</button>
          </div>
          <p className="mt-1 text-sm text-muted">El match compara cada vacante con tu CV y lo que declaraste en Automatización. Es una guía para ordenar, no una probabilidad de que te contraten.</p>
          {evalMsg && <div className="mt-3" role="status"><Notice tone={evalMsg.tone === "error" ? "error" : "info"}>{evalMsg.text}</Notice></div>}

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input type="search" aria-label="Buscar puesto o empresa" placeholder="Buscar puesto o empresa…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className={`${field} lg:col-span-2`} />
            <select aria-label="Estado" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value as Filters["state"] })} className={field}>
              <option value="activas">Para considerar</option>
              <option value="por_verificar">Por verificar</option>
              <option value="bloqueadas">Bloqueadas</option>
              <option value="no_encajan">No encajan (función o nivel)</option>
              <option value="sin_evaluar">Sin evaluar</option>
              <option value="guardadas">Guardadas</option>
              <option value="descartadas">Descartadas</option>
            </select>
            <select aria-label="Ordenar por" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as Filters["sort"] })} className={field}>
              <option value="accion">Ordenar por prioridad de acción</option>
              <option value="match">Ordenar por match</option>
              <option value="novedad">Ordenar por novedad</option>
            </select>
            <select aria-label="Sector" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} className={field}>
              <option value="Todas">Todos los sectores</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <select aria-label="Prioridad de la empresa" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={field}>
              <option value="Todas">Toda prioridad de empresa</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="sin">Por clasificar</option>
            </select>
            <select aria-label="Match mínimo" value={f.minScore} onChange={(e) => setF({ ...f, minScore: Number(e.target.value) })} className={field}>
              <option value={0}>Cualquier match</option>
              {[50, 60, 70, 80, 90].map((n) => <option key={n} value={n}>Match {n} o más</option>)}
            </select>
            <div className="flex gap-2">
              <button type="button" aria-pressed={f.view === "nuevas"} onClick={() => setF({ ...f, view: f.view === "nuevas" ? "todas" : "nuevas" })} className={`${f.view === "nuevas" ? btnDark : btnGhost} flex-1 whitespace-nowrap`}>Nuevas ({newCount})</button>
              <label className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm ring-1 ring-black/[0.12]">
                <input type="checkbox" checked={f.remote} onChange={(e) => setF({ ...f, remote: e.target.checked })} className="h-4 w-4 accent-ink" />
                Remoto
              </label>
            </div>
          </div>

          <p className="mt-3 text-sm text-muted" aria-live="polite">{shown.length === 1 ? "1 vacante" : `${shown.length} vacantes`}</p>
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {shown.slice(0, 200).map((j) => {
              const m = j.match;
              const tracked = trackedOf(j);
              return (
                <li key={j.id} className="flex flex-col rounded-xl p-4 ring-1 ring-black/[0.08]">
                  <div className="flex items-start gap-3">
                    <Monogram name={j.companyName} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted">{j.companyName}</p>
                      <button type="button" onClick={() => openDetail(j)} className="text-left font-semibold leading-snug outline-none hover:underline focus-visible:underline">{j.title}</button>
                    </div>
                    <div className="text-right">
                      {m && m.score !== null ? (
                        <p className="text-xl font-extrabold leading-none">{m.score}<span className="text-xs font-semibold text-muted">/100</span></p>
                      ) : (
                        <Tag tone="warn">Sin evaluar</Tag>
                      )}
                      <div className="mt-1"><PriorityPill p={j.priority} /></div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{[j.location, REMOTE_LABEL[j.remoteType]].filter(Boolean).join(" · ") || "Ubicación sin dato"}</p>
                  {m?.mainReason && m.score !== null && <p className="mt-2 text-sm">{m.mainReason}</p>}
                  {m?.mainBarrier && m.score !== null && <p className="mt-1 text-xs text-muted"><b>Barrera:</b> {m.mainBarrier}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m?.rejected && <Tag tone="danger">No encaja</Tag>}
                    {m && m.score !== null && !m.rejected && <Tag tone={ELIG_TONE[m.eligibility]}>{ELIGIBILITY_LABEL[m.eligibility]}</Tag>}
                    {j.action && <Tag tone={j.action.band === "alta" ? "ok" : "plain"}>Prioridad {j.action.band}</Tag>}
                    {m?.stale && <Tag tone="warn">Desactualizada</Tag>}
                    {isNew(j) && <Tag tone="ok">Nueva</Tag>}
                    {tracked && <Tag tone="ok">En Seguimiento: {STATUSES.find((s) => s.id === tracked.status)?.one}</Tag>}
                    <Tag>{j.publishedAt ? `Publicada ${fmtDate(j.publishedAt)}` : "Sin fecha de publicación"}</Tag>
                    <Tag>Detectada {ago(j.firstSeenAt)}</Tag>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnDark} onClick={() => openDetail(j)}>Analizar oportunidad</button>
                    <button type="button" className={btnGhost} onClick={() => save(j)} aria-label={`Guardar ${j.title} en Seguimiento`}>{tracked ? "Guardada" : "Guardar"}</button>
                    <button type="button" className={btnGhost} onClick={() => void dismiss(j, m?.disposition === "dismissed")}>{m?.disposition === "dismissed" ? "Volver a mostrar" : "Descartar"}</button>
                    <a href={j.url?.startsWith("https://") ? j.url : undefined} target="_blank" rel="noopener noreferrer" className={`${btnGhost} px-3`} aria-label={`Ver aviso original de ${j.title}`}>↗</a>
                  </div>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p className="mt-4 rounded-xl bg-surface-5 px-4 py-8 text-center text-sm text-muted">Ninguna vacante coincide con estos filtros.</p>}
          {shown.length > 200 && <p className="mt-2 text-sm text-muted">Mostramos las primeras 200. Usá los filtros para achicar la lista.</p>}
        </section>
      )}

      {data.pilot.length > 0 && (
        <details className={`${card} p-4 sm:p-5`}>
          <summary className="cursor-pointer text-base font-bold">Vacantes del piloto ({data.pilot.length}) · histórico</summary>
          <div className="mt-3">
            <Notice tone="warn">Piloto 25/11/2026 · vigencia no verificada. Son las del Sheet que importaste: no se tratan como abiertas y el score es editorial, no el match de Radar.</Notice>
          </div>
          <ul className="mt-3 space-y-2">
            {data.pilot.map((j) => (
              <li key={j.id} className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
                <p className="font-semibold">{j.company} · {j.title}</p>
                <p className="text-xs text-muted">{[j.location, j.editorialScore !== null ? `${j.editorialScore}/100 editorial (histórico)` : "", j.date].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {openJob && <OpportunityDrawer job={openJob} tracked={trackedOf(openJob)} onClose={() => setOpenId(null)} onSave={() => save(openJob)} onDismiss={(undo) => dismiss(openJob, undo)} />}
      {toast.node}
    </div>
  );
}
