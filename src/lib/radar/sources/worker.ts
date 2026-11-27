import { randomBytes } from "node:crypto";
import { radarRepos } from "../repo";
import type { CompanySource, MonitoringRun, MonitoringRunItem, SourceProvider } from "../types";
import { ADAPTERS } from "./adapters";
import { applySnapshot } from "./ingest";
import { NetError, sanitizeError, type NetOptions } from "./net";
import { resolveSource } from "./resolve";

/**
 * Worker de monitoreo: recorre las fuentes (globales, una sola vez aunque las sigan varias personas),
 * las resuelve si hace falta, las lee e ingiere el snapshot. Lease por fuente, concurrencia por proveedor,
 * reintentos con jitter en el cliente HTTP y presupuesto de tiempo por corrida. Sin scheduler: lo llama
 * "Revisar ahora", el script `scripts/radar-monitor.ts` o la ruta protegida /api/radar/worker.
 */

export const CONCURRENCY: Record<SourceProvider, number> = { greenhouse: 3, lever: 2, ashby: 2, jsonld: 1, careers: 2 };

export type WorkerOptions = {
  companyIds?: string[];
  trigger?: MonitoringRun["trigger"];
  budgetMs?: number;
  maxSources?: number;
  /** Vuelve a resolver el ATS aunque ya esté resuelto ("Reintentar verificación"). */
  reresolve?: boolean;
  net?: NetOptions;
  now?: () => Date;
  leaseMs?: number;
};

let defaultNet: NetOptions = {};
/** Para tests: red simulada en todo Radar. */
export function setRadarNet(net: NetOptions) {
  defaultNet = net;
}
export const radarNet = () => defaultNet;

const emptyItem = (s: CompanySource, status: MonitoringRunItem["status"], error: string | null = null): MonitoringRunItem => ({
  sourceId: s.id,
  companyId: s.companyId,
  provider: s.provider,
  attempts: 0,
  status,
  complete: false,
  received: 0,
  created: 0,
  modified: 0,
  closed: 0,
  reopened: 0,
  error,
  durationMs: 0,
});

async function saveSource(next: CompanySource) {
  const repos = radarRepos();
  const list = (await repos.sources.forCompanies([next.companyId]))[next.companyId] ?? [];
  const i = list.findIndex((s) => s.id === next.id);
  if (i >= 0) list[i] = next;
  else list.push(next);
  await repos.sources.saveMany({ [next.companyId]: list });
}

const errorBackoffMs = (failures: number) => Math.min(7, 2 ** Math.max(0, failures - 1)) * 6 * 3600_000;

/** Lee UNA fuente: resolución (si hace falta), snapshot, ingestión y estado. Nunca cierra vacantes por un error. */
export async function checkSource(source: CompanySource, opts: { net: NetOptions; now: () => Date; reresolve?: boolean }): Promise<MonitoringRunItem> {
  const repos = radarRepos();
  const started = Date.now();
  const item = emptyItem(source, "pending");
  const net: NetOptions = { ...opts.net, onAttempt: () => { item.attempts++; opts.net.onAttempt?.(); } };
  let s: CompanySource = { ...source, lastAttemptAt: opts.now().toISOString() };

  if (opts.reresolve || s.provider === "careers" || (s.provider !== "jsonld" && !s.externalBoardId)) {
    const [company] = await repos.companies.getMany([s.companyId]);
    const r = await resolveSource(s.careersUrl, net, { companyName: company?.name });
    s = { ...s, provider: r.provider, externalBoardId: r.externalBoardId, region: r.region, resolvedUrl: r.resolvedUrl, status: r.status, statusNote: r.statusNote, resolvedAt: opts.now().toISOString() };
    item.provider = s.provider;
    if (r.status === "manual" || r.status === "error") {
      if (r.status === "error") s.failureCount = (s.failureCount ?? 0) + 1;
      await saveSource(s);
      return { ...item, status: r.status, error: r.status === "error" ? r.statusNote ?? "Error" : null, durationMs: Date.now() - started };
    }
  }

  const adapter = ADAPTERS[s.provider];
  if (!adapter) {
    s = { ...s, status: "manual", statusNote: "Sin lector para esta fuente" };
    await saveSource(s);
    return { ...item, status: "manual", durationMs: Date.now() - started };
  }

  try {
    const snap = await adapter(s, net);
    const [prev] = await repos.jobs.readIndexes([s.id]);
    const res = applySnapshot(prev, snap, { sourceId: s.id, companyId: s.companyId, now: opts.now() });
    await repos.jobs.writeIndex(res.doc);
    if (Object.keys(res.changedDescriptions).length) await repos.jobs.writeDescriptions(res.changedDescriptions);
    const open = Object.values(res.doc.jobs).filter((j) => j.status === "open").length;
    s = {
      ...s,
      ...snap.patch,
      status: res.status,
      statusNote: res.note ?? (res.status === "verified_empty" ? "Leída completa: sin vacantes publicadas" : undefined),
      lastSuccessAt: opts.now().toISOString(),
      failureCount: 0,
      openJobs: open,
      nextDueAt: null,
    };
    await saveSource(s);
    return { ...item, provider: s.provider, status: res.status, complete: snap.complete && res.status !== "partial", received: snap.received, ...res.counts, durationMs: Date.now() - started };
  } catch (err) {
    const failures = (s.failureCount ?? 0) + 1;
    const notFound = err instanceof NetError && (err.status === 404 || err.status === 410);
    const note = notFound ? `El board «${s.externalBoardId}» no existe en ${s.provider} (HTTP ${(err as NetError).status})` : sanitizeError(err);
    // Las vacantes quedan como estaban (última lectura buena); sólo cambia el estado de la fuente.
    s = { ...s, status: "error", statusNote: note, failureCount: failures, nextDueAt: new Date(opts.now().getTime() + errorBackoffMs(failures)).toISOString() };
    await saveSource(s);
    return { ...item, provider: s.provider, status: "error", error: note, durationMs: Date.now() - started };
  }
}

/** Corre una pila de tareas con un máximo de `limit` a la vez. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]();
      }
    }),
  );
  return out;
}

export async function runMonitoring(opts: WorkerOptions = {}): Promise<MonitoringRun> {
  const repos = radarRepos();
  const now = opts.now ?? (() => new Date());
  const budgetMs = opts.budgetMs ?? 60_000;
  const leaseMs = opts.leaseMs ?? 5 * 60_000;
  const owner = `run_${randomBytes(6).toString("hex")}`;
  const t0 = Date.now();
  const startedAt = now().toISOString();

  const companyIds = opts.companyIds ?? (await repos.followed.all());
  const byCompany = await repos.sources.forCompanies([...new Set(companyIds)]);
  // Una fuente por id: aunque dos personas sigan la misma empresa, se lee una sola vez.
  const unique = new Map<string, CompanySource>();
  for (const list of Object.values(byCompany)) for (const s of list) if (!unique.has(s.id)) unique.set(s.id, s);
  const sources = [...unique.values()]
    .filter((s) => opts.reresolve || s.status !== "manual")
    .slice(0, opts.maxSources ?? 100);

  const groups = new Map<SourceProvider, CompanySource[]>();
  for (const s of sources) groups.set(s.provider, [...(groups.get(s.provider) ?? []), s]);

  const items: MonitoringRunItem[] = [];
  await Promise.all(
    [...groups].map(async ([provider, list]) => {
      const results = await pool(
        list.map((s) => async () => {
          if (Date.now() - t0 > budgetMs) return emptyItem(s, "skipped", "Sin presupuesto de tiempo en esta corrida");
          if (!(await repos.leases.acquire(`source:${s.id}`, owner, leaseMs))) return emptyItem(s, "locked", "Otra corrida está leyendo esta fuente");
          try {
            return await checkSource(s, { net: opts.net ?? defaultNet, now, reresolve: opts.reresolve });
          } catch (err) {
            return emptyItem(s, "error", sanitizeError(err));
          } finally {
            await repos.leases.release(`source:${s.id}`);
          }
        }),
        CONCURRENCY[provider] ?? 1,
      );
      items.push(...results);
    }),
  );

  const ok = items.filter((i) => ["success", "verified_empty", "partial", "manual"].includes(i.status)).length;
  const errors = items.filter((i) => i.status === "error").length;
  const skipped = items.filter((i) => i.status === "skipped" || i.status === "locked").length;
  const sum = (k: "created" | "modified" | "closed" | "reopened") => items.reduce((n, i) => n + i[k], 0);
  const run: MonitoringRun = {
    id: owner,
    trigger: opts.trigger ?? "worker",
    startedAt,
    finishedAt: now().toISOString(),
    status: errors ? "con_errores" : skipped || items.some((i) => i.status === "partial") ? "parcial" : "completa",
    budgetMs,
    items,
    totals: { sources: items.length, ok, errors, skipped, created: sum("created"), modified: sum("modified"), closed: sum("closed"), reopened: sum("reopened") },
  };
  if (items.length) await repos.runs.add(run);
  return run;
}
