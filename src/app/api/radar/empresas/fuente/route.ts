import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { addSource } from "@/lib/radar/service";

/** Agrega una página de Careers a una empresa seguida: POST {companyId, careersUrl}. */

export const runtime = "nodejs";

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  return json({ source: await addSource(uid, companyIdFrom(body), String(body.careersUrl ?? "")) }, 201);
});
