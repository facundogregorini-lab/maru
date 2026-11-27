"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestLogin } from "@/lib/loginRequest";
import { DEFAULT_FILTERS, MONITOR_LABELS, applyFilters, filterOptions, type CompanyFilters, type MonitorState } from "@/lib/radar/filters";
import type { ImportRun, TargetView } from "@/lib/radar/types";
import { PrioritySelect, SourceTag, ago, lastSuccess, openJobsLabel } from "./bits";
import { radarApi } from "./api";
import AddCompanyDrawer from "./AddCompanyDrawer";
import CompanyDrawer from "./CompanyDrawer";
import ImportDrawer from "./ImportDrawer";
import { EmptyState, Monogram, Notice, PriorityPill, Skeleton, Stat, Tag, btnDark, btnGhost, btnNeon, card, field, useToast } from "./ui";

type Summary = { p1: number; p2: number; p3: number; unclassified: number; archived: number; total: number; sourcesWithError: number; sourcesPending: number; pilotJobs: number };
export type ListResponse = { items: TargetView[]; summary: Summary; lastImport: ImportRun | null };

const location = (v: TargetView) => [v.company.headquarters, v.company.region].filter(Boolean).join(" · ") || "A confirmar";

export default function CompaniesView() {
  const { email } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<CompanyFilters>(DEFAULT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await radarApi<ListResponse>("/api/radar/empresas"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar tus empresas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (email) void load();
  }, [email, load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const options = useMemo(() => filterOptions(items.filter((v) => v.target.status === "activa")), [items]);
  const visible = useMemo(() => applyFilters(items, filters), [items, filters]);
  const filtered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const set = (patch: Partial<CompanyFilters>) => setFilters((f) => ({ ...f, ...patch }));

  async function patch(companyId: string, body: Record<string, unknown>, ok?: string) {
    setBusy(companyId);
    try {
      await radarApi("/api/radar/empresas", { method: "PATCH", body: { companyId, ...body } });
      await load();
      if (ok) toast.show(ok);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "No se pudo guardar.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function move(companyId: string, direction: "up" | "down") {
    setBusy(companyId);
    try {
      await radarApi("/api/radar/empresas/mover", { method: "POST", body: { companyId, direction } });
      await load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "No se pudo mover.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (email === undefined) return <Skeleton />;
  if (email === null)
    return (
      <EmptyState title="Ingresá para armar tu radar" actions={<button type="button" className={btnDark} onClick={() => void requestLogin("usar Radar laboral")}>Ingresar con Google</button>}>
        <p>Tus empresas, prioridades y notas se guardan en tu cuenta.</p>
      </EmptyState>
    );

  const s = data?.summary;
  const openView = openId ? items.find((v) => v.company.id === openId) ?? null : null;
  const group = (v: TargetView) => visible.filter((x) => x.target.priority === v.target.priority);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Prioridad 1" value={s ? s.p1 : "—"} hint="Objetivo sugerido: 20" />
        <Stat label="Prioridad 2" value={s ? s.p2 : "—"} hint="Objetivo sugerido: 100" />
        <Stat label="Por clasificar" value={s ? s.unclassified : "—"} hint={s ? `${s.p3} en P3 · sin límite` : undefined} />
        <Stat label="Fuentes con error" value={s ? s.sourcesWithError : "—"} hint={s ? `${s.sourcesPending} pendientes de verificar` : undefined} tone={s?.sourcesWithError ? "warn" : undefined} />
      </div>

      <section className={`${card} p-4 sm:p-5`} aria-labelledby="mis-empresas">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mis-empresas" className="mr-auto text-lg font-bold">Mis empresas</h2>
          <button type="button" className={btnGhost} onClick={() => setImporting(true)}>
            <span aria-hidden>↑</span> Importar empresas
          </button>
          <button type="button" className={btnNeon} onClick={() => setAdding(true)}>
            <span aria-hidden>+</span> Agregar empresa
          </button>
        </div>

        {error && <div className="mt-4"><Notice tone="error">{error} <button type="button" className="ml-1 underline" onClick={() => void load()}>Reintentar</button></Notice></div>}
        {s && s.pilotJobs > 0 && (
          <div className="mt-4">
            <Notice>
              Importaste {s.pilotJobs} vacantes del piloto (25/11/2026, vigencia no verificada). Quedan guardadas aparte y no cuentan como abiertas.
            </Notice>
          </div>
        )}

        {!data && loading && <div className="mt-4"><Skeleton /></div>}

        {data && items.length === 0 && (
          <div className="mt-4">
            <EmptyState
              title="Agregá tus primeras empresas"
              actions={
                <>
                  <button type="button" className={btnDark} onClick={() => setImporting(true)}>Importar Research Laboral</button>
                  <button type="button" className={btnGhost} onClick={() => setAdding(true)}>Agregar una empresa</button>
                  <Link href="/radar/descubrimiento" className={btnGhost}>Explorar sugerencias</Link>
                </>
              }
            >
              <p>Importá tu planilla (.xlsx o .csv) o agregalas de a una. Después elegís cuáles son P1, P2 o P3.</p>
            </EmptyState>
          </div>
        )}

        {data && items.length > 0 && (
          <>
            <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
              <div className="flex w-max gap-2" role="group" aria-label="Sector">
                {["Todas", ...options.industries].map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    aria-pressed={filters.industry === ind}
                    onClick={() => set({ industry: ind })}
                    className={`press min-h-9 whitespace-nowrap rounded-full px-3.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 ${filters.industry === ind ? "bg-ink text-white" : "bg-surface hover:bg-line"}`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
              <input type="search" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar empresa…" aria-label="Buscar empresa" className={field} />
              <select aria-label="Prioridad" value={filters.priority} onChange={(e) => set({ priority: e.target.value as CompanyFilters["priority"] })} className={field}>
                <option value="Todas">Todas las prioridades</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
                <option value="sin">Por clasificar</option>
              </select>
              <select aria-label="Región" value={filters.region} onChange={(e) => set({ region: e.target.value })} className={field}>
                <option value="Todas">Todas las regiones</option>
                {options.regions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select aria-label="Estado de monitoreo" value={filters.monitor} onChange={(e) => set({ monitor: e.target.value as MonitorState })} className={field}>
                <option value="todas">Todo estado de fuente</option>
                {(Object.keys(MONITOR_LABELS) as Exclude<MonitorState, "todas">[]).map((k) => (
                  <option key={k} value={k}>{MONITOR_LABELS[k]}</option>
                ))}
              </select>
              <label className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm ring-1 ring-black/[0.12]">
                <input type="checkbox" checked={filters.archived} onChange={(e) => set({ archived: e.target.checked })} className="h-4 w-4 accent-ink" />
                Archivadas ({s?.archived ?? 0})
              </label>
            </div>

            <div className="mt-3 flex items-center gap-3 text-sm text-muted" aria-live="polite">
              <span>{visible.length === 1 ? "1 empresa" : `${visible.length} empresas`}</span>
              {filtered && <button type="button" className="underline underline-offset-2" onClick={() => setFilters(DEFAULT_FILTERS)}>Limpiar filtros</button>}
              {loading && <span>Actualizando…</span>}
            </div>

            {visible.length === 0 ? (
              <p className="mt-6 rounded-xl bg-surface-5 px-4 py-8 text-center text-sm text-muted">Ninguna empresa coincide con estos filtros.</p>
            ) : (
              <>
                {/* Tabla en pantallas medianas y grandes. */}
                <div className="mt-3 hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Mis empresas, ordenadas por prioridad y orden manual</caption>
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr className="border-b border-line">
                        <th scope="col" className="py-2 pr-3 font-semibold">Empresa</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Ubicación</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Prioridad</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Vacantes</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Última revisión</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Fuente</th>
                        <th scope="col" className="py-2 pl-3"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((v) => {
                        const g = group(v);
                        const i = g.indexOf(v);
                        return (
                          <tr key={v.company.id} className="border-b border-line last:border-0">
                            <td className="py-3 pr-3">
                              <div className="flex items-center gap-3">
                                <Monogram name={v.company.name} />
                                <div className="min-w-0">
                                  <button type="button" onClick={() => setOpenId(v.company.id)} className="truncate text-left font-semibold hover:underline focus-visible:underline outline-none">
                                    {v.company.name}
                                  </button>
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {[...v.company.industries, ...v.target.tags].map((t) => <Tag key={t}>{t}</Tag>)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-muted">{location(v)}</td>
                            <td className="px-3 py-3">
                              <PrioritySelect label={`Prioridad de ${v.company.name}`} value={v.target.priority} disabled={busy === v.company.id} onChange={(p) => void patch(v.company.id, { priority: p }, `${v.company.name}: ${p ?? "por clasificar"}`)} />
                            </td>
                            <td className="px-3 py-3 text-muted">{openJobsLabel(v)}</td>
                            <td className="px-3 py-3 text-muted">{ago(lastSuccess(v))}</td>
                            <td className="px-3 py-3"><SourceTag view={v} /></td>
                            <td className="py-3 pl-3">
                              <div className="flex items-center justify-end gap-1">
                                {!filters.archived && (
                                  <>
                                    <button type="button" className={`${btnGhost} h-9 w-9 px-0`} aria-label={`Subir ${v.company.name}`} disabled={i <= 0 || busy === v.company.id} onClick={() => void move(v.company.id, "up")}>↑</button>
                                    <button type="button" className={`${btnGhost} h-9 w-9 px-0`} aria-label={`Bajar ${v.company.name}`} disabled={i === g.length - 1 || busy === v.company.id} onClick={() => void move(v.company.id, "down")}>↓</button>
                                  </>
                                )}
                                <button type="button" className={`${btnGhost} h-9`} onClick={() => setOpenId(v.company.id)}>Ficha</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Cards apiladas en celular. */}
                <ul className="mt-3 space-y-2 md:hidden">
                  {visible.map((v) => (
                    <li key={v.company.id} className="rounded-xl p-3 ring-1 ring-black/[0.08]">
                      <div className="flex items-start gap-3">
                        <Monogram name={v.company.name} />
                        <div className="min-w-0 flex-1">
                          <button type="button" onClick={() => setOpenId(v.company.id)} className="text-left font-semibold outline-none focus-visible:underline">{v.company.name}</button>
                          <p className="text-xs text-muted">{location(v)}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {[...v.company.industries, ...v.target.tags].map((t) => <Tag key={t}>{t}</Tag>)}
                            <SourceTag view={v} />
                          </div>
                        </div>
                        <PriorityPill p={v.target.priority} />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <PrioritySelect label={`Prioridad de ${v.company.name}`} value={v.target.priority} disabled={busy === v.company.id} onChange={(p) => void patch(v.company.id, { priority: p }, `${v.company.name}: ${p ?? "por clasificar"}`)} />
                        <span className="flex-1 text-xs text-muted">{openJobsLabel(v)}</span>
                        <button type="button" className={`${btnGhost} h-10`} onClick={() => setOpenId(v.company.id)}>Ficha</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {openView && (
        <CompanyDrawer
          view={openView}
          onClose={() => setOpenId(null)}
          busy={busy === openView.company.id}
          onPatch={(body, ok) => patch(openView.company.id, body, ok)}
          onChanged={async (m) => {
            await load();
            if (m) toast.show(m);
          }}
          onUnfollow={async () => {
            try {
              await radarApi("/api/radar/empresas", { method: "DELETE", body: { companyId: openView.company.id } });
              setOpenId(null);
              await load();
              toast.show(`Dejaste de seguir ${openView.company.name}`);
            } catch (e) {
              toast.show(e instanceof Error ? e.message : "No se pudo.", "error");
            }
          }}
        />
      )}
      <AddCompanyDrawer
        open={adding}
        onClose={() => setAdding(false)}
        industries={options.industries}
        onAdded={async (name) => {
          await load();
          toast.show(`${name} quedó en tus empresas`);
        }}
      />
      <ImportDrawer
        open={importing}
        onClose={() => setImporting(false)}
        onImported={async (msg) => {
          await load();
          toast.show(msg);
        }}
      />
      {toast.node}
    </div>
  );
}
