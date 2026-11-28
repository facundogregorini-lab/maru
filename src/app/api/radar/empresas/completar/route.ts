import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { completeCompany } from "@/lib/radar/service";

/** Completar la ficha de una empresa seguida (IA + verificación de dominio y ATS): POST {companyId}. */

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  return json(await completeCompany(uid, companyIdFrom(body)));
});
