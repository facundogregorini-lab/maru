import { sessionEmail } from "../auth";
import { DbError, dbConfigured } from "../db";
import { userId } from "../sync/server";
import { radarAllowedFor, radarFlagOn } from "./flag";
import { RadarError } from "./service";
import { TabularError } from "./tabular";

/**
 * Envoltorio de las rutas /api/radar/*: flag apagado o cuenta fuera de la allowlist → 404 (como si no existiera);
 * sin sesión → 401 AUTH_REQUIRED. El `uid` sale siempre de la cookie firmada, nunca del pedido.
 */

const NO_STORE = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
export const notFound = () => new Response("Not found", { status: 404, headers: NO_STORE });

export const COMPANY_ID = /^[ds]:[a-z0-9][a-z0-9.-]{0,119}$/;

type Ctx = { req: Request; uid: string };

export function radarRoute(handler: (ctx: Ctx) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (!radarFlagOn()) return notFound();
    let email: string | null = null;
    try {
      email = sessionEmail(req);
    } catch (err) {
      console.error("[radar] sesión", err instanceof Error ? err.message : err);
    }
    if (!radarAllowedFor(email)) return notFound();
    if (!email) return json({ error: "Ingresá con Google para usar Radar laboral.", code: "AUTH_REQUIRED" }, 401);
    if (!dbConfigured()) return json({ error: "La base de datos todavía no está conectada.", code: "DB_NOT_CONFIGURED" }, 503);
    try {
      return await handler({ req, uid: userId(email) });
    } catch (err) {
      if (err instanceof RadarError) return json({ error: err.message, code: err.code }, err.status);
      if (err instanceof TabularError) return json({ error: err.message, code: err.code }, 422);
      if (err instanceof DbError) {
        console.error("[radar] base", err.message);
        return json({ error: "No pudimos llegar a la base de datos. Probá en un momento.", code: "DB_UNAVAILABLE" }, 503);
      }
      console.error("[radar]", err instanceof Error ? err.message : "error");
      return json({ error: "Algo salió mal. Probá de nuevo.", code: "ERROR" }, 500);
    }
  };
}

export async function readJson(req: Request, maxBytes = 20_000): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (raw.length > maxBytes) throw new RadarError("El pedido es demasiado grande.", "TOO_LARGE", 413);
  try {
    const body = JSON.parse(raw || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new RadarError("Pedido inválido.", "BAD_REQUEST");
  }
}

export function companyIdFrom(body: Record<string, unknown>): string {
  const id = body.companyId;
  if (typeof id !== "string" || !COMPANY_ID.test(id)) throw new RadarError("Empresa inválida.", "BAD_REQUEST");
  return id;
}
