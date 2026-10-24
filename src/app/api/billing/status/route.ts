import { billingJson, billingSession } from "@/lib/billing/http";
import { recordBillingEvent } from "@/lib/billing/log";
import { billingMissing, billingReady, hasPaidAccess, isComplimentary, lastPayment, readRefundOption, readSubscription, refreshSubscription, subscriptionPlan } from "@/lib/billing/server";
import { billingEnabled } from "@/lib/plans";
import { dbConfigured } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const email = billingSession(req);
  const enabled = billingReady();
  // Nombres de lo que falta (nunca valores), para saber por qué no se puede contratar.
  const missing = enabled ? undefined : billingMissing();
  if (!email || !dbConfigured()) return billingJson({ enabled, missing, plan: "gratis", tier: null, status: "none", paidThrough: null });
  try {
    const sub = await readSubscription(email);
    // lastPayment: último pago acreditado y verificado (id de Mercado Pago, importe, moneda, primero o renovación), para medir la compra.
    const refundOption = sub ? await readRefundOption(email, sub) : null;
    // cancelRequest / refund: números de solicitud para mostrar; refundOption: si hoy puede pedir la devolución y hasta cuándo.
    // Cuenta del equipo (PRO_EMAILS): plan activo sin suscripción.
    const cortesia = isComplimentary(email);
    return billingJson({ enabled, missing, cortesia, plan: hasPaidAccess(sub) || cortesia ? "maru" : "gratis", tier: sub ? subscriptionPlan(sub) : null, status: sub?.status ?? "none", paidThrough: sub?.paidThrough ?? null, lastPayment: lastPayment(sub ?? null), cancelRequest: sub?.cancelRequest ?? null, refund: sub?.refund ? { id: sub.refund.id, at: sub.refund.at, kind: sub.refund.kind, amount: sub.refund.amount } : null, refundOption });
  } catch { return billingJson({ error: "No pudimos consultar tu plan.", code: "PLAN_UNAVAILABLE" }, 503); }
}
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return billingJson({ error: "Ingresá con tu email.", code: "AUTH_REQUIRED" }, 401);
  if (!billingEnabled()) return GET(req);
  try {
    const sub = await refreshSubscription(email);
    await recordBillingEvent({ source: "actualizar", type: "estado", result: hasPaidAccess(sub) ? "plan activo" : "sin pago acreditado", detail: `suscripción ${sub?.status ?? "inexistente"}` });
    return GET(req);
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 200) : "error";
    console.error("[billing status]", detail);
    await recordBillingEvent({ source: "actualizar", type: "estado", result: "error", detail });
    // El detalle viene de nuestros mensajes o del código HTTP de Mercado Pago: sin datos personales ni claves.
    return billingJson({ error: "No pudimos actualizar tu suscripción.", detail, code: "PLAN_UNAVAILABLE" }, 503);
  }
}
