import { sessionEmail } from "../auth";
import { FREE_LIMITS, type UsageKind } from "../plans";
import { clientIp } from "../rateLimit";
import { SITE_URL } from "../site";
import { allowUsage, billingReady, hasPaidPlan, takeAnonymousUsage, takeUsage } from "./server";

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

const INSTALL_ID = /^[A-Za-z0-9-]{16,64}$/;
/**
 * Cupo de la extensión de Chrome: 4 autocompletados por día en el plan gratis. Si Chrome manda la sesión de Maru,
 * cuenta por cuenta (y un plan pago usa el límite del plan); si no, por instalación de la extensión y por IP.
 * No exige ingresar: la extensión funciona sin cuenta.
 */
export async function extensionGuard(req: Request): Promise<{ blocked: Response | null; remaining: number | null; limit: number }> {
  const limit = FREE_LIMITS.autofill.limit;
  if (!billingReady()) return { blocked: null, remaining: null, limit };
  let email: string | null = null;
  try { email = sessionEmail(req); } catch { email = null; }
  const install = req.headers.get("X-Maru-Install");
  try {
    const r = email ? await takeUsage(email, "autofill") : await takeAnonymousUsage(install && INSTALL_ID.test(install) ? install : null, clientIp(req.headers), "autofill");
    if (r.ok) return { blocked: null, remaining: r.remaining, limit };
    return {
      blocked: billingJson({ error: `Usaste los ${limit} autocompletados gratis de hoy. Se renuevan a las 0 h.`, code: "PLAN_LIMIT", upgradeUrl: `${SITE_URL}/precios`, remaining: 0, limit }, 429),
      remaining: 0,
      limit,
    };
  } catch { return { blocked: billingJson({ error: "No pudimos verificar tu plan. Probá en un momento.", code: "PLAN_UNAVAILABLE" }, 503), remaining: null, limit }; }
}
