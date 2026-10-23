import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { billingReady, CheckoutRejected, startCheckout } from "@/lib/billing/server";
import { isPlanId } from "@/lib/plans";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!billingReady()) return billingJson({ error: "La suscripción todavía no está habilitada.", code: "BILLING_DISABLED" }, 503);
  const { plan = "mensual" } = (await req.json().catch(() => ({}))) as { plan?: unknown };
  if (!isPlanId(plan)) return billingJson({ error: "Elegí un plan válido.", code: "BAD_PLAN" }, 400);
  // checkoutId: id público del checkout (hash), para medir el inicio de pago una sola vez por checkout.
  try { return billingJson(await startCheckout(email, plan)); }
  catch (err) {
    console.error("[checkout]", err instanceof Error ? err.message : "error");
    if (err instanceof Error && err.message.startsWith("Tenés un pago pendiente")) return billingJson({ error: err.message, code: "CHECKOUT_PENDING" }, 409);
    if (err instanceof Error && err.message.startsWith("Tu pago se está preparando")) return billingJson({ error: err.message, code: "CHECKOUT_BUSY" }, 409);
    if (err instanceof CheckoutRejected) return billingJson({ error: "Mercado Pago no aceptó crear la suscripción. Probá de nuevo en un momento; si vuelve a pasar, escribinos.", code: "CHECKOUT_REJECTED" }, 502);
    return billingJson({ error: "No pudimos preparar el pago. Si ya autorizaste la suscripción, revisá su estado antes de intentarlo otra vez.", code: "CHECKOUT_FAILED" }, 502);
  }
}
