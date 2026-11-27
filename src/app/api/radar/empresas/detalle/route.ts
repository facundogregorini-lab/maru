import { COMPANY_ID, json, radarRoute } from "@/lib/radar/http";
import { RadarError, companyDetail } from "@/lib/radar/service";

/** Ficha: GET ?companyId= → vacantes activas y cerradas, e historial de corridas. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ req, uid }) => {
  const id = new URL(req.url).searchParams.get("companyId") ?? "";
  if (!COMPANY_ID.test(id)) throw new RadarError("Empresa inválida.", "BAD_REQUEST");
  return json(await companyDetail(uid, id));
});
