import { json, radarRoute } from "@/lib/radar/http";
import { radarRepos } from "@/lib/radar/repo";
import { RadarError } from "@/lib/radar/service";
import { runMonitoring } from "@/lib/radar/sources/worker";

/** «Revisar ahora» de Automatización: todas las empresas activas de la persona. Una vez cada 30 minutos. */

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = radarRoute(async ({ uid }) => {
  const repos = radarRepos();
  const ids = Object.values((await repos.targets.read(uid)).items).filter((t) => t.status === "activa").map((t) => t.companyId);
  if (!ids.length) throw new RadarError("Todavía no seguís empresas.", "NO_COMPANIES", 409);
  if (!(await repos.leases.acquire(`review-all:${uid}`, uid, 30 * 60_000))) throw new RadarError("Ya revisaste hace menos de 30 minutos. Probá un poco más tarde.", "COOLDOWN", 429);
  const run = await runMonitoring({ companyIds: ids, trigger: "manual", budgetMs: 90_000 });
  return json({ run: { ...run, items: run.items.map(({ sourceId, companyId, provider, status, received, created, modified, closed, error }) => ({ sourceId, companyId, provider, status, received, created, modified, closed, error })) } });
});
