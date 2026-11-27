"use client";

import { useCallback, useEffect, useState } from "react";
import type { JobOpening, MonitoringRun, TargetView } from "@/lib/radar/types";
import { trackRadar } from "@/lib/radar/analytics";
import { radarApi } from "./api";
import { PROVIDER_LABEL, PrioritySelect, REMOTE_LABEL, SOURCE_STATUS_LABEL, SourceTag, ago, fmtDate } from "./bits";
import { Drawer, Monogram, Notice, Tag, btnDark, btnGhost, field } from "./ui";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted">Sin dato</span>}</dd>
    </div>
  );
}

type Detail = { open: JobOpening[]; closed: JobOpening[]; runs: MonitoringRun[] };
const RUN_STATUS: Record<string, string> = { ...SOURCE_STATUS_LABEL, skipped: "Salteada (sin tiempo)", locked: "Otra revisión en curso" };

export function JobRow({ j }: { j: JobOpening }) {
  return (
    <li className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
      <p className="font-semibold">{j.title}</p>
      <p className="text-xs text-muted">
        {[j.location, REMOTE_LABEL[j.remoteType]].filter(Boolean).join(" · ") || "Ubicación sin dato"}
        {j.publishedAt ? ` · Publicada ${fmtDate(j.publishedAt)}` : ""} · Detectada {ago(j.firstSeenAt)}
        {j.status === "closed" && j.closedAt ? ` · Cerrada ${fmtDate(j.closedAt)}` : ""}
      </p>
      <a href={j.url?.startsWith("https://") ? j.url : undefined} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline underline-offset-2">
        Ver aviso original
      </a>
    </li>
  );
}

/** Ficha de una empresa seguida: datos del catálogo, fuentes y su monitoreo, vacantes, notas y prioridad. */
export default function CompanyDrawer({
  view,
  onClose,
  onPatch,
  onUnfollow,
  onChanged,
  busy,
}: {
  view: TargetView;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>, ok?: string) => Promise<void>;
  onUnfollow: () => Promise<void>;
  onChanged: (msg?: string) => Promise<void>;
  busy: boolean;
}) {
  const { company: c, target: t, sources } = view;
  const [notes, setNotes] = useState(t.notes);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [working, setWorking] = useState<"review" | "reresolve" | "source" | null>(null);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  useEffect(() => setNotes(t.notes), [t.notes]);
  const archived = t.status === "archivada";

  const loadDetail = useCallback(async () => {
    try {
      setDetail(await radarApi<Detail>(`/api/radar/empresas/detalle?companyId=${encodeURIComponent(c.id)}`));
      setDetailError("");
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "No pudimos cargar las vacantes.");
    }
  }, [c.id]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function review(reresolve: boolean) {
    setWorking(reresolve ? "reresolve" : "review");
    setMsg(null);
    try {
      const { run } = await radarApi<{ run: MonitoringRun }>("/api/radar/empresas/revisar", { method: "POST", body: { companyId: c.id, reresolve } });
      const tt = run.totals;
      trackRadar("radar_scan_completed", { company_id: c.id, provider: run.items[0]?.provider, count: tt.created, status: run.status });
      const err = run.items.find((i) => i.error)?.error;
      setMsg(err ? { text: `La revisión terminó con un problema: ${err}`, tone: "error" } : { text: `Revisión lista: ${tt.created} nuevas, ${tt.modified} modificadas, ${tt.closed} cerradas.`, tone: "info" });
      await Promise.all([loadDetail(), onChanged()]);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "No se pudo revisar.", tone: "error" });
    } finally {
      setWorking(null);
    }
  }

  async function addSource() {
    setWorking("source");
    setMsg(null);
    try {
      await radarApi("/api/radar/empresas/fuente", { method: "POST", body: { companyId: c.id, careersUrl: newUrl } });
      setNewUrl("");
      await onChanged("Página de Careers agregada");
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "No se pudo agregar.", tone: "error" });
    } finally {
      setWorking(null);
    }
  }

  return (
    <Drawer title={c.name} open onClose={onClose}>
      <div className="flex items-start gap-3">
        <Monogram name={c.name} size={48} />
        <div className="min-w-0">
          <p className="text-sm text-muted">{[c.headquarters, c.region].filter(Boolean).join(" · ") || "Ubicación a confirmar"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.industries.map((i) => <Tag key={i}>{i}</Tag>)}
            <SourceTag view={view} />
            {archived && <Tag tone="warn">Archivada</Tag>}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold">Prioridad</p>
          <PrioritySelect label={`Prioridad de ${c.name}`} value={t.priority} disabled={busy} onChange={(p) => void onPatch({ priority: p }, `${c.name}: ${p ?? "por clasificar"}`)} />
        </div>
        <p className="pb-2 text-xs text-muted">Una sola prioridad para todos sus sectores.</p>
      </div>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Vacantes detectadas</h3>
      {detailError && <div className="mt-2"><Notice tone="error">{detailError}</Notice></div>}
      {!detail && !detailError && <p className="mt-2 text-sm text-muted">Cargando…</p>}
      {detail && (
        <>
          <p className="mt-1 text-xs text-muted">Sin evaluar: el match con tu perfil llega en la próxima etapa.</p>
          {detail.open.length ? (
            <ul className="mt-2 space-y-2">{detail.open.slice(0, 50).map((j) => <JobRow key={j.id} j={j} />)}</ul>
          ) : (
            <p className="mt-2 text-sm text-muted">{sources.some((s) => s.lastSuccessAt) ? "No hay vacantes abiertas en la última lectura." : "Todavía no se leyó ninguna fuente."}</p>
          )}
          {detail.open.length > 50 && <p className="mt-2 text-xs text-muted">Y {detail.open.length - 50} más en Oportunidades.</p>}
          {detail.closed.length > 0 && (
            <button type="button" className="mt-3 text-sm underline underline-offset-2" aria-expanded={showClosed} onClick={() => setShowClosed((x) => !x)}>
              {showClosed ? "Ocultar cerradas" : `Ver ${detail.closed.length} cerradas`}
            </button>
          )}
          {showClosed && <ul className="mt-2 space-y-2 opacity-80">{detail.closed.map((j) => <JobRow key={j.id} j={j} />)}</ul>}
        </>
      )}

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Fuentes y monitoreo</h3>
      {sources.length ? (
        <ul className="mt-2 space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
              <p className="font-semibold">
                {PROVIDER_LABEL[s.provider]}
                {s.externalBoardId ? ` · ${s.externalBoardId}` : ""}
                {s.region === "eu" ? " (EU)" : ""}
              </p>
              <a href={s.careersUrl} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{s.careersUrl}</a>
              <p className="mt-1 text-xs">
                <Tag tone={s.status === "error" ? "danger" : s.status === "success" || s.status === "verified_empty" ? "ok" : "warn"}>{SOURCE_STATUS_LABEL[s.status] ?? s.status}</Tag>
              </p>
              {s.statusNote && <p className="mt-1 text-xs text-muted">{s.statusNote}</p>}
              <p className="mt-1 text-xs text-muted">
                Última lectura buena: {ago(s.lastSuccessAt)}
                {s.lastAttemptAt && s.lastAttemptAt !== s.lastSuccessAt ? ` · Último intento: ${ago(s.lastAttemptAt)}` : ""}
                {s.declaredStatus ? ` · En el Sheet: «${s.declaredStatus}»` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Sin página de Careers registrada.</p>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addSource();
        }}
      >
        <label htmlFor="radar-nueva-fuente" className="sr-only">Otra página de Careers</label>
        <input id="radar-nueva-fuente" type="url" required value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://empresa.com/careers" className={field} />
        <button type="submit" className={btnGhost} disabled={working !== null}>{working === "source" ? "Agregando…" : "Agregar"}</button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnDark} disabled={working !== null || !sources.length} onClick={() => void review(false)}>
          {working === "review" ? "Revisando…" : "Revisar ahora"}
        </button>
        <button type="button" className={btnGhost} disabled={working !== null || !sources.length} onClick={() => void review(true)}>
          {working === "reresolve" ? "Verificando…" : "Reintentar verificación"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Se puede revisar una vez cada 10 minutos.</p>
      {msg && <div className="mt-2" role="status"><Notice tone={msg.tone === "error" ? "error" : "info"}>{msg.text}</Notice></div>}

      {detail && detail.runs.length > 0 && (
        <>
          <h4 className="mt-5 text-sm font-semibold">Historial de revisiones</h4>
          <ul className="mt-1 divide-y divide-line text-xs">
            {detail.runs.map((r) =>
              r.items.map((i) => (
                <li key={`${r.id}-${i.sourceId}`} className="flex flex-wrap gap-x-2 py-1.5">
                  <span className="font-medium">{fmtDate(r.startedAt)} {new Date(r.startedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{RUN_STATUS[i.status] ?? i.status}</span>
                  <span className="text-muted">{i.received} leídas · {i.created} nuevas · {i.modified} modificadas · {i.closed} cerradas{i.reopened ? ` · ${i.reopened} reabiertas` : ""}</span>
                  {i.error && <span className="text-danger-dark">{i.error}</span>}
                </li>
              )),
            )}
          </ul>
        </>
      )}

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Empresa</h3>
      <dl className="mt-1">
        <Row label="Actividad">{c.description}</Row>
        <Row label="Sede">{c.headquarters}</Row>
        <Row label="Etapa">{c.stage}</Row>
        <Row label="Tamaño estimado">
          {c.employeeBand && (
            <>
              {c.employeeBand}
              {c.metadataSource && <span className="text-muted"> · {c.metadataSource.label}, {c.metadataSource.at}</span>}
            </>
          )}
        </Row>
        <Row label="Áreas sugeridas">{c.suggestedAreas.join(", ")}</Row>
        <Row label="Identidad">
          {c.canonicalDomain ? (
            <>
              {c.canonicalDomain} <span className="text-muted">({c.domainVerified ? "verificado" : "dominio declarado, sin verificar"})</span>
            </>
          ) : (
            <span>Provisoria: sin dominio.</span>
          )}
        </Row>
        {c.rankings.length > 0 && <Row label="Ranking del Sheet">{c.rankings.map((r) => `${r.industry}${r.region ? ` ${r.region}` : ""}: #${r.rank}`).join(" · ")}</Row>}
      </dl>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Notas personales</h3>
      <label htmlFor="radar-notas" className="sr-only">Notas personales sobre {c.name}</label>
      <textarea id="radar-notas" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-2`} placeholder="Contactos, por qué te interesa, qué averiguar…" />
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={btnDark} disabled={busy || notes === t.notes} onClick={() => void onPatch({ notes }, "Notas guardadas")}>Guardar notas</button>
        <span className="text-xs text-muted">Sólo las ves vos.</span>
      </div>

      <div className="mt-8 border-t border-line pt-5">
        <Notice>Archivar o dejar de seguir no toca tus postulaciones en Seguimiento.</Notice>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={busy} onClick={() => void onPatch({ status: archived ? "activa" : "archivada" }, archived ? `${c.name} volvió a tus empresas` : `${c.name} archivada`)}>
            {archived ? "Reactivar" : "Archivar"}
          </button>
          <button
            type="button"
            className={`${btnGhost} text-danger-dark`}
            disabled={busy}
            onClick={() => {
              if (window.confirm(`¿Dejar de seguir ${c.name}? Se borran tu prioridad y tus notas de esta empresa.`)) void onUnfollow();
            }}
          >
            Dejar de seguir
          </button>
        </div>
      </div>
    </Drawer>
  );
}
