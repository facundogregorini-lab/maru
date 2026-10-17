import { randomUUID } from "node:crypto";
import { compareAndSetJson, dbConfigured, getManyJson, setJson, takeCounter } from "../db";
import { userId } from "../sync/server";
import { billingEnabled, billingFlagState, FREE_LIMITS, PAID_DAILY_LIMIT, PLANS, type PlanId, type UsageKind } from "../plans";
import { SITE_URL } from "../site";
import { mp, type Invoice, type Payment, type Preapproval } from "./provider";

/** `plan` falta en suscripciones creadas antes de los tres planes: eran mensuales. */
export type Subscription = { id: string; reference: string; status: string; plan?: PlanId; checkoutUrl?: string; paidThrough?: number; paymentId?: number; paymentAt?: number; updatedAt: number };
const key = (email: string) => `maru:billing:${userId(email)}`;
export const billingReady = () => billingEnabled() && dbConfigured() && !!process.env.MERCADOPAGO_ACCESS_TOKEN && !!process.env.MERCADOPAGO_WEBHOOK_SECRET;
/** Qué falta para cobrar, sólo con nombres (nunca valores), para diagnosticar desde /api/billing/status. */
export function billingMissing(): string[] {
  const flag = billingFlagState();
  return [
    flag === "missing" ? "NEXT_PUBLIC_BILLING_ENABLED" : flag === "other" ? "NEXT_PUBLIC_BILLING_ENABLED (no es true)" : "",
    process.env.MERCADOPAGO_ACCESS_TOKEN ? "" : "MERCADOPAGO_ACCESS_TOKEN",
    process.env.MERCADOPAGO_WEBHOOK_SECRET ? "" : "MERCADOPAGO_WEBHOOK_SECRET",
    dbConfigured() ? "" : "Redis (KV_REST_API_URL / KV_REST_API_TOKEN o REDIS_URL)",
  ].filter(Boolean);
}
export const readSubscription = async (email: string) => (await getManyJson<Subscription>([key(email)]))[0];
export const hasPaidAccess = (sub: Subscription | null, now = Date.now()) => !!sub?.paidThrough && sub.paidThrough > now;
export const subscriptionPlan = (sub: Subscription | null): PlanId => sub?.plan ?? "mensual";

async function change(email: string, fn: (s: Subscription) => Subscription): Promise<Subscription> {
  for (let i = 0; i < 5; i++) {
    const prev = await readSubscription(email);
    if (!prev) throw new Error("No encontramos la suscripción.");
    const next = { ...fn(prev), updatedAt: Math.max(Date.now(), prev.updatedAt + 1) };
    if ((await compareAndSetJson(key(email), prev.updatedAt, next)).ok) return next;
  }
  throw new Error("La suscripción se está actualizando. Probá otra vez.");
}
export async function checkout(email: string, planId: PlanId): Promise<string> {
  if (!billingReady()) throw new Error("La suscripción todavía no está habilitada.");
  const prev = await readSubscription(email);
  if (hasPaidAccess(prev)) throw new Error("Ya tenés el plan activo.");
  if (prev?.checkoutUrl && prev.status === "pending") {
    if (subscriptionPlan(prev) === planId) return prev.checkoutUrl;
    throw new Error(`Tenés un pago pendiente del plan ${PLANS[subscriptionPlan(prev)].nombre.toLowerCase()}. Cancelalo para elegir otro.`);
  }
  if (prev?.status === "authorized") throw new Error("Ya tenés una suscripción autorizada. Estamos esperando la confirmación del pago.");
  if (prev?.status === "creating" && Date.now() - prev.updatedAt < 120_000) throw new Error("Tu pago se está preparando. Probá en un momento.");
  // Un reintento reutiliza la referencia (clave de idempotencia), así que conserva también su plan.
  const retry = prev?.status === "creating";
  const reference = retry ? prev.reference : randomUUID();
  const plan = PLANS[retry ? subscriptionPlan(prev) : planId];
  const reservation: Subscription = { id: "", reference, status: "creating", plan: plan.id, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) };
  if (!(await compareAndSetJson(key(email), prev?.updatedAt ?? 0, reservation)).ok) throw new Error("Tu pago se está preparando. Probá en un momento.");
  // La referencia se genera en el servidor y queda vinculada a la sesión; no se toma el email del webhook.
  await setJson(`maru:billing:ref:${reference}`, { email });
  const sub = await mp<Preapproval>("/preapproval", {
    method: "POST",
    headers: { "X-Idempotency-Key": reference },
    body: JSON.stringify({ reason: `Maru · Plan ${plan.nombre.toLowerCase()}`, external_reference: reference, payer_email: email, back_url: `${SITE_URL}/precios?estado=pendiente`, status: "pending", auto_recurring: { frequency: plan.frequency, frequency_type: plan.frequencyType, transaction_amount: plan.price, currency_id: "ARS" } }),
  });
  if (!sub.id || !sub.init_point || !/^https:\/\/([a-z0-9-]+\.)?mercadopago\.com(\.ar)?\//i.test(sub.init_point)) throw new Error("Mercado Pago no devolvió un link de pago válido.");
  await change(email, (current) => ({ ...current, id: sub.id, status: sub.status, checkoutUrl: sub.init_point }));
  return sub.init_point;
}
export async function refreshSubscription(email: string): Promise<Subscription | null> {
  const current = await readSubscription(email);
  if (!current?.id || !billingReady()) return current;
  // Además de la guardada, cualquier suscripción con nuestra referencia: Mercado Pago puede terminar
  // autorizando otra en el checkout, y entonces la guardada queda "pending" para siempre.
  const ids = new Set([current.id]);
  const errors: unknown[] = [];
  try {
    const found = await mp<{ results?: Preapproval[] }>(`/preapproval/search?q=${encodeURIComponent(current.reference)}&limit=20`);
    for (const sub of found.results ?? []) if (sub.id && sub.external_reference === current.reference) ids.add(sub.id);
  } catch (err) { errors.push(err); }
  for (const id of ids) {
    try {
      await processNotification("subscription_preapproval", id);
      // Recupera la confirmación si el webhook se demoró o no llegó. El pago se verifica por la misma vía.
      const invoices = await mp<{ results?: Invoice[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}&limit=50`);
      const latest = (invoices.results ?? []).filter((invoice) => invoice.payment?.id).sort((a,b) => Number(b.id) - Number(a.id)).slice(0,3);
      for (const invoice of latest) {
        try { await processNotification("subscription_authorized_payment", String(invoice.id)); }
        catch (err) { errors.push(err); }
      }
    } catch (err) { errors.push(err); }
  }
  const next = await readSubscription(email);
  for (const err of errors) console.error("[billing refresh]", err instanceof Error ? err.message : "error");
  // Un paso fallido no tapa lo que sí se pudo conciliar.
  if (errors.length && !hasPaidAccess(next)) throw errors[0];
  return next;
}
export async function cancel(email: string): Promise<void> {
  const current = await readSubscription(email);
  if (!current?.id || !billingReady()) throw new Error("No encontramos una suscripción para cancelar.");
  const result = await mp<Preapproval>(`/preapproval/${encodeURIComponent(current.id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  if (result.status !== "cancelled") throw new Error("No pudimos confirmar la cancelación.");
  await change(email, (s) => ({ ...s, status: "cancelled", checkoutUrl: undefined }));
}
/** Reconsulta recursos con credenciales propias. Repetir una notificación no suma meses. */
export async function processNotification(type: string, id: string): Promise<void> {
  let invoice: Invoice | undefined;
  let sub: Preapproval;
  let payment: Payment | undefined;
  if (type === "payment") {
    const binding = (await getManyJson<{ subId: string }>([`maru:billing:payment:${id}`]))[0];
    if (!binding) return;
    payment = await mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
    sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(binding.subId)}`);
  } else if (type === "subscription_authorized_payment") {
    invoice = await mp<Invoice>(`/authorized_payments/${encodeURIComponent(id)}`);
    sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(invoice.preapproval_id)}`);
  } else if (type === "subscription_preapproval") {
    sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
  } else return;
  if (!sub.external_reference || !/^[a-f0-9-]{36}$/i.test(sub.external_reference)) return;
  const binding = (await getManyJson<{ email: string }>([`maru:billing:ref:${sub.external_reference}`]))[0];
  if (!binding) return;
  const current = await readSubscription(binding.email);
  if (!current || current.reference !== sub.external_reference) return;
  // Otra suscripción con la misma referencia (secreta, del servidor) sólo reemplaza a la guardada si quedó autorizada.
  if (current.id && current.id !== sub.id && sub.status !== "authorized") return;
  if (invoice?.payment?.id) payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
  if (payment) await setJson(`maru:billing:payment:${payment.id}`, { subId: sub.id });
  await change(binding.email, (s) => {
    if (s.reference !== sub.external_reference) return s;
    const next = { ...s, id: sub.id, status: sub.status };
    if (!payment) return next; // Autorizar el débito no equivale a cobrarlo.
    const at = Date.parse(payment.date_approved);
    const plan = PLANS[subscriptionPlan(s)];
    if (payment.transaction_amount !== plan.price || payment.currency_id !== "ARS" || !Number.isFinite(at) || at > Date.now() + 60_000) return next;
    if (payment.status === "approved" && !payment.transaction_amount_refunded) {
      if (at < (s.paymentAt ?? 0)) return next;
      return { ...next, paymentId: payment.id, paymentAt: at, paidThrough: periodEnd(at, plan.frequency, plan.frequencyType) };
    }
    if (s.paymentId === payment.id) return { ...next, paidThrough: 0 };
    return next;
  });
}
/** Fin del período pago: días exactos o el mismo día del mes siguiente (el último, si ese mes es más corto). */
export function periodEnd(at: number, frequency: number, type: "days" | "months"): number {
  if (type === "days") return at + frequency * 86400_000;
  const end = new Date(at);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + frequency);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end.getTime();
}
/** Día (AAAA-MM-DD) y lunes de la semana en hora de Argentina (UTC-3, sin horario de verano). */
export function usageWindow(window: "dia" | "semana", now = Date.now()): string {
  const local = new Date(now - 3 * 3600_000);
  if (window === "semana") local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return `${window === "semana" ? "s" : "d"}${local.toISOString().slice(0, 10)}`;
}
export async function hasPaidPlan(email: string): Promise<boolean> {
  // Con la bandera encendida pero sin credenciales o base, Maru sigue como en el lanzamiento en lugar de cortar la IA.
  if (!billingReady()) return true;
  return hasPaidAccess(await readSubscription(email));
}
export async function allowUsage(email: string, kind: UsageKind, now = Date.now()): Promise<boolean> {
  if (!billingReady()) return true;
  const paid = await hasPaidPlan(email);
  const { limit, window } = paid ? { limit: PAID_DAILY_LIMIT, window: "dia" as const } : FREE_LIMITS[kind];
  const ttl = (window === "semana" ? 8 : 2) * 86400_000;
  return (await takeCounter(`maru:usage:${userId(email)}:${usageWindow(window, now)}:${paid ? "plan" : kind}`, limit, ttl, now)) === 0;
}
