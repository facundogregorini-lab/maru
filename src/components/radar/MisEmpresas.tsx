"use client";

import { useCallback, useMemo, useState } from "react";
import { capture } from "@/lib/tracking/posthog";
import { counts, filterCompanies, industriesOf, move, setPriority, type CompanyFilters } from "@/lib/radar/state";
import { STATE_LABEL, type CompanyStatus, type SourceState } from "@/lib/radar/sourceState";
import { PRIORITIES, PRIORITY_TARGET, type Priority, type TargetCompany } from "@/lib/radar/types";
import { PrioritySelect, SourcePill } from "./Controls";
import AddCompany from "./AddCompany";
import CompanyDetail from "./CompanyDetail";
import ImportCompanies from "./ImportCompanies";
import { Avatar, Note, Stat, Toast, btn, btnInk, btnNeon, card, field, fmtDate } from "./RadarUi";
import { isStale, useCompanyStatus } from "./useCompanyStatus";
import { useRadar } from "./useRadar";

const DEFAULT_FILTERS: CompanyFilters = { industry: "todas", priority: "todas", region: "todas", q: "", archived: false, status: "todos" };

export default function MisEmpresas() {
  const { state, ready, update } = useRadar();
  const status = useCompanyStatus(state, ready);
  const [f, setF] = useState<CompanyFilters>(DEFAULT_FILTERS);
  const [panel, setPanel] = useState<"agregar" | "importar" | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  const c = counts(state);
  const industries = industriesOf(state);
  const rows = useMemo(() => filterCompanies(state, f, (x) => status.statuses[x.id]?.state ?? ""), [state, f, status.statuses]);
  const sourceIssues = Object.values(state.companies).filter((x) => !x.archived && ["error", "sin_fuente", "incorporable"].includes(status.statuses[x.id]?.state ?? "")).length;
  const stale = isStale(status.generatedAt);

  const changePriority = (co: TargetCompany, p: Priority | null) => {
    update((s) => setPriority(s, co.id, p));
    capture("radar_priority_changed", { prioridad: p ?? "sin", source: "radar" });
  };

  if (!ready) return <p className="py-10 text-center text-sm text-muted">Cargando tus empresas…</p>;

  const empty = c.total === 0 && c.archived === 0;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Prioridad 1" value={c.P1} hint={`Objetivo sugerido: ${PRIORITY_TARGET.P1}`} />
        <Stat title="Prioridad 2" value={c.P2} hint={`Objetivo sugerido: ${PRIORITY_TARGET.P2}`} />
        <Stat title="Por clasificar" value={c.sin} hint={`${c.P3} por explorar (P3)`} />
        <Stat title="Fuentes para revisar" value={status.loading && !Object.keys(status.statuses).length ? "…" : sourceIssues} hint="Sin fuente, con error o listas para sumar" />
      </div>

      <section className={card}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">Mis empresas</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => setPanel("importar")}>
              ↑ Importar empresas
            </button>
            <button type="button" className={btnNeon} onClick={() => setPanel("agregar")}>
              + Agregar empresa
            </button>
          </div>
        </div>

        {empty ? (
          <div className="py-10 text-center">
            <p className="text-lg font-bold">Agregá tus primeras empresas</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Importá tu planilla de research (Excel o CSV) o sumalas de a una. Después ordenalas por prioridad: P1 son las que más te interesan.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button type="button" className={btnInk} onClick={() => setPanel("importar")}>
                Importar empresas
              </button>
              <button type="button" className={btn} onClick={() => setPanel("agregar")}>
                Buscar en el catálogo
              </button>
            </div>
          </div>
        ) : (
          <>
            {status.error && <Note>{status.error} Lo que guardaste sigue acá.</Note>}
            {stale && <Note>Los avisos son de la última sincronización ({fmtDate(status.generatedAt)}). Puede haber búsquedas nuevas o cerradas desde entonces.</Note>}

            <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Sector">
              {["todas", ...industries].map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={f.industry === i}
                  onClick={() => setF({ ...f, industry: i })}
                  className={`press shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${f.industry === i ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
                >
                  {i === "todas" ? "Todas" : i}
                </button>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <label className="min-w-[180px] flex-1">
                <span className="sr-only">Buscar empresa</span>
                <input className={`${field} w-full`} placeholder="Buscar empresa…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
              </label>
              <label>
                <span className="sr-only">Prioridad</span>
                <select className={field} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as CompanyFilters["priority"] })}>
                  <option value="todas">Todas las prioridades</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="sin">Sin clasificar</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Región</span>
                <select className={field} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}>
                  <option value="todas">Todas las regiones</option>
                  <option value="LatAm">LatAm</option>
                  <option value="Global">Global</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Estado de la fuente</span>
                <select className={field} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                  <option value="todos">Todos los estados</option>
                  {(Object.keys(STATE_LABEL) as SourceState[]).map((s) => (
                    <option key={s} value={s}>
                      {STATE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={f.archived} onChange={(e) => setF({ ...f, archived: e.target.checked })} className="h-4 w-4 accent-[#00a975]" />
                Archivadas ({c.archived})
              </label>
            </div>

            {!rows.length ? (
              <p className="py-10 text-center text-sm text-muted">No hay empresas con estos filtros.</p>
            ) : (
              <>
                {/* Escritorio: tabla. */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                        <th scope="col" className="px-2 py-2.5 font-semibold">Empresa</th>
                        <th scope="col" className="px-2 py-2.5 font-semibold">Ubicación</th>
                        <th scope="col" className="px-2 py-2.5 font-semibold">Prioridad</th>
                        <th scope="col" className="px-2 py-2.5 font-semibold">Búsquedas abiertas</th>
                        <th scope="col" className="px-2 py-2.5 font-semibold">Fuente</th>
                        <th scope="col" className="px-2 py-2.5 font-semibold"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((co, i) => {
                        const s = status.statuses[co.id];
                        return (
                          <tr key={co.id} className="border-b border-[#edf0f1] last:border-0">
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={co.name} />
                                <div className="min-w-0">
                                  <p className="truncate font-bold">{co.name}</p>
                                  <p className="truncate text-xs text-muted">{co.industries.join(" · ") || "Sin sector"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <p>{co.hq || "—"}</p>
                              <p className="text-xs text-muted">{co.region || ""}</p>
                            </td>
                            <td className="px-2 py-3">
                              <PrioritySelect value={co.priority} name={co.name} onChange={(p) => changePriority(co, p)} />
                            </td>
                            <td className="px-2 py-3">
                              <Openings s={s} />
                            </td>
                            <td className="px-2 py-3">
                              <SourcePill s={s} loading={status.loading} />
                              <p className="mt-1 text-xs text-muted">{s?.lastOkAt ? `Revisada el ${fmtDate(s.lastOkAt)}` : ""}</p>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {!f.archived && (
                                  <>
                                    <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface disabled:opacity-30" aria-label={`Subir ${co.name}`} disabled={i === 0 || rows[i - 1].priority !== co.priority} onClick={() => update((st) => move(st, co.id, -1))}>
                                      ↑
                                    </button>
                                    <button type="button" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface disabled:opacity-30" aria-label={`Bajar ${co.name}`} disabled={i === rows.length - 1 || rows[i + 1].priority !== co.priority} onClick={() => update((st) => move(st, co.id, 1))}>
                                      ↓
                                    </button>
                                  </>
                                )}
                                <button type="button" className={btn} onClick={() => setDetail(co.id)}>
                                  Ver ficha ›
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Celular: tarjetas apiladas. */}
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map((co) => {
                    const s = status.statuses[co.id];
                    return (
                      <li key={co.id} className="rounded-xl border border-line p-3">
                        <div className="flex items-start gap-3">
                          <Avatar name={co.name} size={36} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold">{co.name}</p>
                            <p className="text-xs text-muted">{[co.industries.join(" · "), co.hq].filter(Boolean).join(" · ")}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <SourcePill s={s} loading={status.loading} />
                              <Openings s={s} />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <PrioritySelect value={co.priority} name={co.name} onChange={(p) => changePriority(co, p)} />
                          <button type="button" className={`${btn} ml-auto`} onClick={() => setDetail(co.id)}>
                            Ver ficha ›
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {status.generatedAt && <p className="mt-3 text-xs text-muted">Avisos actualizados el {fmtDate(status.generatedAt)}. Maru lee las bolsas de empleo una vez por día.</p>}
          </>
        )}
      </section>

      <AddCompany
        open={panel === "agregar"}
        onClose={() => setPanel(null)}
        industries={industries}
        onAdded={(name, existed) => {
          setToast(existed ? `${name} ya estaba en tu lista.` : `Sumaste ${name}.`);
          if (!existed) capture("radar_company_followed", { source: "radar" });
        }}
      />
      <ImportCompanies open={panel === "importar"} onClose={() => setPanel(null)} onDone={(msg) => setToast(msg)} />
      <CompanyDetail id={detail} status={detail ? status.statuses[detail] : undefined} statusLoading={status.loading} onRefresh={status.refresh} onClose={() => setDetail(null)} onToast={setToast} />
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function Openings({ s }: { s: CompanyStatus | undefined }) {
  if (!s) return <span className="text-muted">—</span>;
  if (!s.open) return <span className="text-muted">0</span>;
  return (
    <span>
      <b>{s.open}</b> <span className="text-xs text-muted">· {s.eligible} desde Argentina</span>
    </span>
  );
}
