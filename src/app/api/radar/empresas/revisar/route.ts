import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { reviewNow } from "@/lib/radar/service";

/** "Revisar ahora" / "Reintentar verificación": POST {companyId, reresolve?}. Cooldown de 10 minutos por empresa. */

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const run = await reviewNow(uid, companyIdFrom(body), { reresolve: body.reresolve === true });
  return json({ run });
});
