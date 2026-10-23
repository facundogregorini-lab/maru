import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { billingReady, CheckoutRejected, startCheckout } from "@/lib/billing/server";
import { isPlanId } from "@/lib/plans";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!billingReady()) return billingJson({ error: "La suscripción todavía no está habilitada.", code: "BILLING_DISABLED" }, 503);
  const { plan = "mensual", payerEmail } = (await req.json().catch(() => ({}))) as { plan?: unknown; payerEmail?: unknown };
  if (!isPlanId(plan)) return billingJson({ error: "Elegí un plan válido.", code: "BAD_PLAN" }, 400);
  // Opcional: el email de la cuenta de Mercado Pago Argentina con la que se va a pagar.
  const payer = typeof payerEmail === "string" ? payerEmail.trim().toLowerCase() : "";
  if (payer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer)) return billingJson({ error: "Revisá el email de tu cuenta de Mercado Pago.", code: "BAD_PAYER" }, 400);
  // checkoutId: id público del checkout (hash), para medir el inicio de pago una sola vez por checkout.
  try { return billingJson(await startCheckout(email, plan, payer || undefined)); }
  catch (err) {
    console.error("[checkout]", err instanceof Error ? err.message : "error");
    if (err instanceof Error && err.message.startsWith("Tenés un pago pendiente")) return billingJson({ error: err.message, code: "CHECKOUT_PENDING" }, 409);
    if (err instanceof Error && err.message.startsWith("Tu pago se está preparando")) return billingJson({ error: err.message, code: "CHECKOUT_BUSY" }, 409);
    if (err instanceof CheckoutRejected && err.otherSite) {
      return billingJson({ error: "Mercado Pago no aceptó este email como pagador. Suele pasar cuando el email está asociado a una cuenta de Mercado Pago o Mercado Libre de otro país. Si tenés otra cuenta de Mercado Pago Argentina, escribí ese email.", code: "PAYER_OTHER_SITE" }, 409);
    }
    if (err instanceof CheckoutRejected && err.sameAccount) {
      return billingJson({ error: "Ese email es el de la cuenta de Mercado Pago que cobra los planes: no se puede pagar con la misma cuenta.", code: "PAYER_IS_COLLECTOR" }, 409);
    }
    if (err instanceof CheckoutRejected) return billingJson({ error: "Mercado Pago no aceptó crear la suscripción. Probá de nuevo en un momento; si vuelve a pasar, escribinos.", code: "CHECKOUT_REJECTED" }, 502);
    return billingJson({ error: "No pudimos preparar el pago. Si ya autorizaste la suscripción, revisá su estado antes de intentarlo otra vez.", code: "CHECKOUT_FAILED" }, 502);
  }
}
