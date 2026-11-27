import type { MatchState } from "../match/clientStore";
import { readDocsByUid } from "../sync/server";
import { radarFlagOn } from "./flag";
import { NoProfileError, evaluateForUser } from "./match/engine";
import { deliver, type Sender } from "./notify";
import { radarRepos } from "./repo";
import { globalInterval, intervalFor, isDue } from "./schedule";
import { readSettings } from "./service";
import { runMonitoring } from "./sources/worker";
import type { CompanySource } from "./types";

/**
 * Cron de Radar. Tres fases separadas, cada una idempotente:
 * 1. crawl: sólo despacha las fuentes vencidas (`nextDueAt`), con la frecuencia mínima entre quienes las siguen;
 * 2. match: evalúa lo nuevo o cambiado de cada persona con Radar activo;
 * 3. deliver: alertas, resumen y emails, con claves idempotentes.
 * Con RADAR_ENABLED apagado no hace nada. Un lock evita dos corridas a la vez.
 */

export type CronPhase = "crawl" | "match" | "deliver";
export type CronSummary = {
  skipped?: "flag" | "locked";
  crawl?: { due: number; sources: number; ok: number; errors: number; created: number; closed: number };
  match?: { users: number; ia: number; rules: number; noProfile: number };
  deliver?: { users: number; alerts: number; digests: number; emailsSent: number; emailsFailed: number; cancelled: number };
};

export async function runRadarCron(opts: { now?: Date; phases?: CronPhase[]; send?: Sender | null; budgetMs?: number; maxLlmPerUser?: number } = {}): Promise<CronSummary> {
  if (!radarFlagOn()) return { skipped: "flag" };
  const repos = radarRepos();
  const now = opts.now ?? new Date();
  const phases = opts.phases ?? ["crawl", "match", "deliver"];
  if (!(await repos.leases.acquire("cron", "cron", 15 * 60_000))) return { skipped: "locked" };
  const out: CronSummary = {};
  try {
    const users = await repos.followers.users();
    const settingsByUser = new Map(await Promise.all(users.map(async (u) => [u, await readSettings(u)] as const)));
    const targetsByUser = new Map(await Promise.all(users.map(async (u) => [u, await repos.targets.read(u)] as const)));

    if (phases.includes("crawl")) {
      const companies = new Set<string>();
      for (const t of targetsByUser.values()) for (const id of Object.keys(t.items)) companies.add(id);
      const interval = new Map<string, number>();
      for (const c of companies) {
        const followers = users.filter((u) => targetsByUser.get(u)?.items[c]);
        const g = globalInterval(followers.map((u) => intervalFor(settingsByUser.get(u)!, targetsByUser.get(u)!, c)));
        if (g !== null) interval.set(c, g);
      }
      const byCompany = await repos.sources.forCompanies([...interval.keys()]);
      const due = [...interval.keys()].filter((c) => (byCompany[c] ?? []).some((s) => isDue(s, now.getTime())));
      const run = await runMonitoring({ companyIds: due, trigger: "worker", budgetMs: opts.budgetMs ?? 180_000, now: () => now });
      // Próxima revisión según la frecuencia global (los errores ya traen su propio backoff).
      const okIds = new Set(run.items.filter((i) => ["success", "verified_empty", "partial"].includes(i.status)).map((i) => i.sourceId));
      if (okIds.size) {
        const fresh = await repos.sources.forCompanies(due);
        const patch: Record<string, CompanySource[]> = {};
        for (const [c, list] of Object.entries(fresh)) {
          if (!list.some((s) => okIds.has(s.id))) continue;
          patch[c] = list.map((s) => (okIds.has(s.id) ? { ...s, nextDueAt: new Date(now.getTime() + interval.get(c)!).toISOString() } : s));
        }
        await repos.sources.saveMany(patch);
      }
      out.crawl = { due: due.length, sources: run.totals.sources, ok: run.totals.ok, errors: run.totals.errors, created: run.totals.created, closed: run.totals.closed };
    }

    const active = users.filter((u) => settingsByUser.get(u)?.enabled);

    if (phases.includes("match")) {
      const m = { users: 0, ia: 0, rules: 0, noProfile: 0 };
      for (const u of active) {
        const docs = await readDocsByUid(u);
        const state = (docs.match?.data ?? null) as MatchState | null;
        try {
          const r = await evaluateForUser(u, { profile: state?.profile ?? null, prefs: state?.prefs ?? null }, settingsByUser.get(u)!, { maxLlm: opts.maxLlmPerUser ?? 30, now: () => now });
          m.users++;
          m.ia += r.ia;
          m.rules += r.rules;
        } catch (err) {
          if (err instanceof NoProfileError) m.noProfile++;
          else console.error("[radar/cron] match", err instanceof Error ? err.message.slice(0, 120) : "error");
        }
      }
      out.match = m;
    }

    if (phases.includes("deliver")) {
      const d = { users: 0, alerts: 0, digests: 0, emailsSent: 0, emailsFailed: 0, cancelled: 0 };
      // También las pausadas: así se cancela lo pendiente.
      for (const u of users) {
        const r = await deliver(u, { now, send: opts.send ?? null });
        d.users++;
        d.alerts += r.alerts;
        d.digests += r.digest ? 1 : 0;
        d.emailsSent += r.emailsSent;
        d.emailsFailed += r.emailsFailed;
        d.cancelled += r.cancelled;
      }
      out.deliver = d;
    }
    return out;
  } finally {
    await repos.leases.release("cron");
  }
}
