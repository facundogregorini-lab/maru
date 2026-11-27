import { weeklySuggestions, discoveryFeedback } from "@/lib/radar/discovery";
import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { RadarError } from "@/lib/radar/service";

/** Descubrimiento. GET: sugerencias de la semana. POST {companyId, action: "P1" | "P2" | "no"}: feedback. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => json(await weeklySuggestions(uid)));

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const action = body.action;
  if (action !== "P1" && action !== "P2" && action !== "no") throw new RadarError("Acción inválida.", "BAD_REQUEST");
  try {
    await discoveryFeedback(uid, companyIdFrom(body), action);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") throw new RadarError("No encontramos esa empresa.", "NOT_FOUND", 404);
    throw err;
  }
  return json({ ok: true });
});
