import { timingSafeEqual } from "node:crypto";
import { radarFlagOn } from "@/lib/radar/flag";
import { json, notFound } from "@/lib/radar/http";
import { runMonitoring } from "@/lib/radar/sources/worker";

/**
 * Worker de monitoreo, protegido con RADAR_WORKER_SECRET (Authorization: Bearer …).
 * Todavía no lo llama ningún cron: sólo a mano o desde un script. Con el flag apagado, 404.
 * POST {companyIds?, budgetMs?, maxSources?}
 */

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.RADAR_WORKER_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 24 || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!radarFlagOn()) return notFound();
  if (!authorized(req)) return json({ error: "No autorizado.", code: "UNAUTHORIZED" }, 401);
  const body = (await req.json().catch(() => ({}))) as { companyIds?: unknown; budgetMs?: unknown; maxSources?: unknown };
  const companyIds = Array.isArray(body.companyIds) ? body.companyIds.filter((x): x is string => typeof x === "string").slice(0, 500) : undefined;
  const budgetMs = typeof body.budgetMs === "number" ? Math.min(240_000, Math.max(5_000, body.budgetMs)) : 240_000;
  const maxSources = typeof body.maxSources === "number" ? Math.min(500, Math.max(1, body.maxSources)) : 200;
  const run = await runMonitoring({ companyIds, budgetMs, maxSources, trigger: "worker" });
  return json({ run: { ...run, items: run.items.map(({ sourceId, companyId, provider, status, received, created, modified, closed, error }) => ({ sourceId, companyId, provider, status, received, created, modified, closed, error })) } });
}
