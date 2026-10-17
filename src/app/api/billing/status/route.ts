import { billingJson, billingSession } from "@/lib/billing/http";
import { billingMissing, billingReady, hasPaidAccess, readSubscription, refreshSubscription, subscriptionPlan } from "@/lib/billing/server";
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
    return billingJson({ enabled, missing, plan: hasPaidAccess(sub) ? "maru" : "gratis", tier: sub ? subscriptionPlan(sub) : null, status: sub?.status ?? "none", paidThrough: sub?.paidThrough ?? null });
  } catch { return billingJson({ error: "No pudimos consultar tu plan.", code: "PLAN_UNAVAILABLE" }, 503); }
}
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return billingJson({ error: "Ingresá con tu email.", code: "AUTH_REQUIRED" }, 401);
  if (!billingEnabled()) return GET(req);
  try { await refreshSubscription(email); return GET(req); }
  catch (err) {
    console.error("[billing status]", err instanceof Error ? err.message : "error");
    return billingJson({ error: "No pudimos actualizar tu suscripción.", code: "PLAN_UNAVAILABLE" }, 503);
  }
}
