import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { billingReady, checkout } from "@/lib/billing/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!billingReady()) return billingJson({ error: "La suscripción todavía no está habilitada.", code: "BILLING_DISABLED" }, 503);
  try { return billingJson({ url: await checkout(email) }); }
  catch (err) {
    console.error("[checkout]", err instanceof Error ? err.message : "error");
    return billingJson({ error: "No pudimos preparar el pago. Si ya autorizaste la suscripción, revisá su estado antes de intentarlo otra vez.", code: "CHECKOUT_FAILED" }, 502);
  }
}
