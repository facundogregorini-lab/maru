import { sessionEmail } from "../auth";
import type { UsageKind } from "../plans";
import { allowUsage, billingReady, hasPaidPlan } from "./server";

export const billingJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export function billingSession(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin && origin !== new URL(req.url).origin) return null;
  try {
    const email = sessionEmail(req);
    const expected = req.headers.get("X-Maru-Account");
    return expected && expected !== email ? null : email;
  } catch { return null; }
}
export const loginRequired = () => billingJson({ error: "Ingresá con Google para continuar.", code: "AUTH_REQUIRED" }, 401);
export async function planGuard(req: Request, kind?: UsageKind): Promise<Response | null> {
  if (!billingReady()) return null;
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!kind) return null;
  try {
    if (await allowUsage(email, kind)) return null;
    return billingJson({ error: "Llegaste al límite gratis de hoy (o de esta semana, en entrevistas y videos). Con un plan de Maru no tenés que esperar.", code: "PLAN_LIMIT", upgradeUrl: "/precios" }, 429);
  } catch { return billingJson({ error: "No pudimos verificar tu plan. Probá en un momento.", code: "PLAN_UNAVAILABLE" }, 503); }
}
/** Funciones exclusivas del plan: true con cobro apagado o plan activo. Si no se puede verificar, se trata como gratis. */
export async function paidFeatures(req: Request): Promise<boolean> {
  if (!billingReady()) return true;
  const email = billingSession(req);
  if (!email) return false;
  try { return await hasPaidPlan(email); } catch { return false; }
}
