import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { RadarError, moveTarget } from "@/lib/radar/service";

/** Orden manual: POST {companyId, direction: "up" | "down"}. */

export const runtime = "nodejs";

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  if (body.direction !== "up" && body.direction !== "down") throw new RadarError("Dirección inválida.", "BAD_REQUEST");
  return json({ moved: await moveTarget(uid, companyIdFrom(body), body.direction) });
});
