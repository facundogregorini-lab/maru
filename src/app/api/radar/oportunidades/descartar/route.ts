import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { setDisposition } from "@/lib/radar/match/engine";
import { RadarError, assertFollows } from "@/lib/radar/service";

/** Descartar (o volver a mostrar) una vacante: POST {companyId, jobId, undo?}. Es una preferencia personal. */

export const runtime = "nodejs";

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const companyId = companyIdFrom(body);
  const jobId = typeof body.jobId === "string" && /^job_[a-f0-9]{20}$/.test(body.jobId) ? body.jobId : null;
  if (!jobId) throw new RadarError("Vacante inválida.", "BAD_REQUEST");
  await assertFollows(uid, companyId);
  await setDisposition(uid, companyId, jobId, body.undo === true ? null : "dismissed");
  return json({ ok: true });
});
