import { createHash, randomUUID } from "node:crypto";
import { compareAndSetJson, dbConfigured, getManyJson, setJson, takeCounter } from "../db";
import { userId } from "../sync/server";
import { billingEnabled, billingFlagState, FREE_LIMITS, PAID_DAILY_LIMIT, PLANS, type PlanId, type UsageKind } from "../plans";
import { SITE_URL } from "../site";
import { mp, type Invoice, type Payment, type Preapproval } from "./provider";

/**
 * `plan` falta en suscripciones creadas antes de los tres planes: eran mensuales.
 * `firstPaymentId`: el primer pago acreditado de la suscripción (los siguientes son renovaciones). Falta en
 * suscripciones que ya tenían un pago antes de guardarlo; esas no se informan como primera compra.
 * `paymentLive`: false si Mercado Pago marcó el último pago como de prueba (no se mide como compra).
 */
export type Subscription = { id: string; reference: string; status: string; plan?: PlanId; checkoutUrl?: string; paidThrough?: number; paymentId?: number; paymentAt?: number; firstPaymentId?: number; paymentLive?: boolean; updatedAt: number };
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
/** Id público y estable del checkout para deduplicar la conversión: hash de la referencia interna (que no sale del servidor). */
export const checkoutId = (reference: string) => createHash("sha256").update(`maru-checkout:${reference}`).digest("hex").slice(0, 32);

/** Último pago acreditado, ya verificado contra Mercado Pago, sin datos personales (para medir la compra en el navegador). */
export function lastPayment(sub: Subscription | null): { id: string; amount: number; currency: "ARS"; first: boolean; at: number; plan: PlanId } | null {
  if (!sub?.paymentId || !sub.paymentAt || sub.paymentLive === false || !hasPaidAccess(sub)) return null;
  const plan = subscriptionPlan(sub);
  return { id: String(sub.paymentId), amount: PLANS[plan].price, currency: "ARS", first: sub.firstPaymentId === sub.paymentId, at: sub.paymentAt, plan };
}

export async function checkout(email: string, planId: PlanId): Promise<string> {
  return (await startCheckout(email, planId)).url;
}

/** Igual que `checkout`, pero devuelve también el id del checkout (el mismo en reintentos de la misma suscripción pendiente). */
export async function startCheckout(email: string, planId: PlanId): Promise<{ url: string; checkoutId: string }> {
  if (!billingReady()) throw new Error("La suscripción todavía no está habilitada.");
  const prev = await readSubscription(email);
  if (hasPaidAccess(prev)) throw new Error("Ya tenés el plan activo.");
  if (prev?.checkoutUrl && prev.status === "pending") {
    if (subscriptionPlan(prev) === planId) return { url: prev.checkoutUrl, checkoutId: checkoutId(prev.reference) };
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
  return { url: sub.init_point, checkoutId: checkoutId(reference) };
}
export async function refreshSubscription(email: string): Promise<Subscription | null> {
  const current = await readSubscription(email);
  if (!current?.id || !billingReady()) return current;
  // Además de la guardada, cualquier suscripción con nuestra referencia: Mercado Pago puede terminar
  // autorizando otra en el checkout, y entonces la guardada queda "pending" para siempre.
  const ids = new Set([current.id]);
  const errors: unknown[] = [];
  const skipped: string[] = [];
  const log = (err: unknown) => console.error("[billing refresh]", err instanceof Error ? err.message : "error");
  // Búsquedas auxiliares: si fallan se registran, pero no tapan el resultado.
  try {
    const found = await mp<{ results?: Preapproval[] }>(`/preapproval/search?q=${encodeURIComponent(current.reference)}`);
    for (const sub of found.results ?? []) if (sub.id && sub.external_reference === current.reference) ids.add(sub.id);
  } catch (err) { log(err); }
  for (const id of ids) {
    try {
      await processNotification("subscription_preapproval", id);
      // Recupera la confirmación si el webhook se demoró o no llegó. El pago se verifica por la misma vía.
      const invoices = await mp<{ results?: Invoice[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}`);
      const latest = (invoices.results ?? []).filter((invoice) => invoice.payment?.id).sort((a,b) => Number(b.id) - Number(a.id)).slice(0,3);
      for (const invoice of latest) {
        try { const why = await processNotification("subscription_authorized_payment", String(invoice.id)); if (why) skipped.push(why); }
        catch (err) { errors.push(err); }
      }
    } catch (err) { errors.push(err); }
  }
  // Último recurso: los pagos de la suscripción llevan su referencia. Pasan por la misma validación.
  let next = await readSubscription(email);
  if (next && !hasPaidAccess(next)) {
    try {
      const found = await mp<{ results?: Payment[] }>(`/v1/payments/search?external_reference=${encodeURIComponent(current.reference)}&sort=date_created&criteria=desc`);
      for (const payment of (found.results ?? []).filter((p) => p.status === "approved").slice(0, 3)) {
        await setJson(`maru:billing:payment:${payment.id}`, { subId: next.id });
        const why = await processNotification("payment", String(payment.id));
        if (why) skipped.push(why);
      }
    } catch (err) { log(err); }
    next = await readSubscription(email);
  }
  errors.forEach(log);
  skipped.forEach((why) => console.error("[billing refresh]", why));
  // Un paso fallido no tapa lo que sí se pudo conciliar; sin pago todavía, se sigue esperando sin error.
  if (!hasPaidAccess(next)) {
    if (errors.length) throw errors[0];
    if (skipped.length) throw new Error(skipped[0]);
  }
  return next;
}
export async function cancel(email: string): Promise<void> {
  const current = await readSubscription(email);
  if (!current?.id || !billingReady()) throw new Error("No encontramos una suscripción para cancelar.");
  const result = await mp<Preapproval>(`/preapproval/${encodeURIComponent(current.id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  if (result.status !== "cancelled") throw new Error("No pudimos confirmar la cancelación.");
  await change(email, (s) => ({ ...s, status: "cancelled", checkoutUrl: undefined }));
}
/** Reconsulta recursos con credenciales propias. Repetir una notificación no suma meses.
 * Devuelve el motivo si vio un pago aprobado que no acreditó (sin datos personales).
 * `note` recibe qué se hizo con la notificación, sin datos personales, para el registro del panel. */
export async function processNotification(type: string, id: string, note: (what: string) => void = () => {}): Promise<string | undefined> {
  let invoice: Invoice | undefined;
  let sub: Preapproval;
  let payment: Payment | undefined;
  if (type === "payment") {
    const binding = (await getManyJson<{ subId: string }>([`maru:billing:payment:${id}`]))[0];
    // Normal si llega antes que el comprobante: ese aviso trae el mismo pago.
    if (!binding) { note("pago sin suscripción vinculada todavía"); return; }
    payment = await mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
    sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(binding.subId)}`);
  } else if (type === "subscription_authorized_payment") {
    invoice = await mp<Invoice>(`/authorized_payments/${encodeURIComponent(id)}`);
    sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(invoice.preapproval_id)}`);
  } else if (type === "subscription_preapproval") {
    sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
  } else { note(`tipo no usado: ${type.slice(0, 40) || "vacío"}`); return; }
  if (!sub.external_reference || !/^[a-f0-9-]{36}$/i.test(sub.external_reference)) { note("suscripción sin referencia de Maru"); return; }
  const binding = (await getManyJson<{ email: string }>([`maru:billing:ref:${sub.external_reference}`]))[0];
  if (!binding) { note("referencia desconocida"); return; }
  const current = await readSubscription(binding.email);
  if (!current || current.reference !== sub.external_reference) { note("la cuenta ya tiene otra suscripción"); return; }
  // Otra suscripción con la misma referencia (secreta, del servidor) sólo reemplaza a la guardada si quedó autorizada.
  if (current.id && current.id !== sub.id && sub.status !== "authorized") { note(`otra suscripción con la misma referencia (${sub.status})`); return; }
  if (invoice?.payment?.id) payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
  if (payment) await setJson(`maru:billing:payment:${payment.id}`, { subId: sub.id });
  let skipped: string | undefined;
  await change(binding.email, (s) => {
    if (s.reference !== sub.external_reference) return s;
    const next = { ...s, id: sub.id, status: sub.status };
    if (!payment) return next; // Autorizar el débito no equivale a cobrarlo.
    const at = Date.parse(payment.date_approved);
    const plan = PLANS[subscriptionPlan(s)];
    if (payment.transaction_amount !== plan.price || payment.currency_id !== "ARS" || !Number.isFinite(at) || at > Date.now() + 60_000) {
      if (payment.status === "approved") skipped = `Pago aprobado sin acreditar: ${payment.transaction_amount} ${payment.currency_id} (plan ${plan.id}: ${plan.price} ARS), fecha ${Number.isFinite(at) ? "ok" : "inválida"}.`;
      return next;
    }
    if (payment.status === "approved" && !payment.transaction_amount_refunded) {
      if (at < (s.paymentAt ?? 0)) return next;
      // El primer pago acreditado de la suscripción queda guardado: los siguientes son renovaciones.
      const firstPaymentId = s.firstPaymentId ?? (s.paymentId ? undefined : payment.id);
      return { ...next, paymentId: payment.id, paymentAt: at, paidThrough: periodEnd(at, plan.frequency, plan.frequencyType), paymentLive: payment.live_mode !== false, ...(firstPaymentId ? { firstPaymentId } : {}) };
    }
    if (s.paymentId === payment.id) return { ...next, paidThrough: 0 };
    return next;
  });
  note(payment ? `suscripción ${sub.status}, pago ${payment.status}${skipped ? " sin acreditar" : ""}` : `suscripción ${sub.status}`);
  return skipped;
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
