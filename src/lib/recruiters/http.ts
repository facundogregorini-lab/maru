import { billingSession } from "../billing/http";
import { UserFacingError } from "../claude";
import { dbConfigured } from "../db";
import { takeAi } from "./store";

export const recJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Maru Recruiters exige cuenta (las búsquedas se guardan en la base) y que el pedido venga de Maru. */
export function recruiterEmail(req: Request): string {
  if (!dbConfigured()) throw new UserFacingError("Maru Recruiters no está disponible en este momento. Probá en un rato.", "DB_UNAVAILABLE", 503);
  const email = billingSession(req);
  if (!email) throw new UserFacingError("Ingresá con Google para usar Maru Recruiters.", "AUTH_REQUIRED", 401);
  return email;
}

/** Reserva lecturas con IA del cupo diario o corta con un error claro. */
export async function reserveAi(email: string, n = 1): Promise<void> {
  const r = await takeAi(email, n);
  if (!r.ok) {
    throw new UserFacingError(`Llegaste a las ${r.limit} lecturas con IA de hoy. Se renuevan a las 0 h. Si necesitás más, escribinos a hola@marucoach.com.`, "REC_LIMIT", 429);
  }
}
