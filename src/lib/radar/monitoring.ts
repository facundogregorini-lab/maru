import { radarRepos } from "./repo";
import { INTERVAL_MS } from "./schedule";
import { readSettings } from "./service";
import type { MonitoringRun } from "./types";

/** Estado del monitoreo para Automatización: lo que pasó con las fuentes de las empresas que sigue la persona. */
export async function monitoringStatus(uid: string) {
  const repos = radarRepos();
  const [settings, targets] = await Promise.all([readSettings(uid), repos.targets.read(uid)]);
  const ids = Object.values(targets.items).filter((t) => t.status === "activa").map((t) => t.companyId);
  const sources = Object.values(await repos.sources.forCompanies(ids)).flat();
  const now = Date.now();
  const expected = sources.filter((s) => s.status !== "manual");
  const verified = expected.filter((s) => s.lastSuccessAt && now - Date.parse(s.lastSuccessAt) < (INTERVAL_MS[settings.frequencies.P1] ?? 7 * 86_400_000) * 1.5);
  const runs = (await Promise.all(sources.map((s) => repos.runs.forSource(s.id)))).flat();
  const byId = new Map<string, MonitoringRun>();
  for (const r of runs) {
    const cur = byId.get(r.id);
    byId.set(r.id, cur ? { ...cur, items: [...cur.items, ...r.items] } : r);
  }
  const history = [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 20);
  const next = settings.enabled ? expected.map((s) => s.nextDueAt).filter(Boolean).sort()[0] ?? null : null;
  return {
    enabled: settings.enabled,
    lastRun: history[0] ?? null,
    sources: { expected: expected.length, verified: verified.length, manual: sources.length - expected.length, errors: expected.filter((s) => s.status === "error").length },
    nextDueAt: next,
    history,
  };
}
