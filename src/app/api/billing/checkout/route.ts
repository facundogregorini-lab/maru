import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { billingReady, checkout } from "@/lib/billing/server";
import { isPlanId } from "@/lib/plans";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!billingReady()) return billingJson({ error: "La suscripción todavía no está habilitada.", code: "BILLING_DISABLED" }, 503);
  const { plan = "mensual" } = (await req.json().catch(() => ({}))) as { plan?: unknown };
  if (!isPlanId(plan)) return billingJson({ error: "Elegí un plan válido.", code: "BAD_PLAN" }, 400);
  try { return billingJson({ url: await checkout(email, plan) }); }
  catch (err) {
    console.error("[checkout]", err instanceof Error ? err.message : "error");
    if (err instanceof Error && err.message.startsWith("Tenés un pago pendiente")) return billingJson({ error: err.message, code: "CHECKOUT_PENDING" }, 409);
    return billingJson({ error: "No pudimos preparar el pago. Si ya autorizaste la suscripción, revisá su estado antes de intentarlo otra vez.", code: "CHECKOUT_FAILED" }, 502);
  }
}
