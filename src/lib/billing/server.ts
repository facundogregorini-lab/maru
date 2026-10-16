import { randomUUID } from "node:crypto";
import { compareAndSetJson, dbConfigured, getManyJson, setJson, takeCounter } from "../db";
import { userId } from "../sync/server";
import { BILLING_ENABLED, FREE_LIMITS, PAID_MONTHLY_LIMIT, PLAN_PRICE, type UsageKind } from "../plans";
import { SITE_URL } from "../site";
import { mp, type Invoice, type Payment, type Preapproval } from "./provider";

export type Subscription = { id: string; reference: string; status: string; checkoutUrl?: string; paidThrough?: number; paymentId?: number; paymentAt?: number; updatedAt: number };
const key = (email: string) => `maru:billing:${userId(email)}`;
export const billingReady = () => BILLING_ENABLED && dbConfigured() && !!process.env.MERCADOPAGO_ACCESS_TOKEN && !!process.env.MERCADOPAGO_WEBHOOK_SECRET;
export const readSubscription = async (email: string) => (await getManyJson<Subscription>([key(email)]))[0];
export const hasPaidAccess = (sub: Subscription | null, now = Date.now()) => !!sub?.paidThrough && sub.paidThrough > now;

async function change(email: string, fn: (s: Subscription) => Subscription): Promise<Subscription> {
  for (let i = 0; i < 5; i++) {
    const prev = await readSubscription(email);
    if (!prev) throw new Error("No encontramos la suscripción.");
    const next = { ...fn(prev), updatedAt: Math.max(Date.now(), prev.updatedAt + 1) };
    if ((await compareAndSetJson(key(email), prev.updatedAt, next)).ok) return next;
  }
  throw new Error("La suscripción se está actualizando. Probá otra vez.");
}
export async function checkout(email: string): Promise<string> {
  if (!billingReady()) throw new Error("La suscripción todavía no está habilitada.");
  const prev = await readSubscription(email);
  if (hasPaidAccess(prev)) throw new Error("Ya tenés el plan activo.");
  if (prev?.checkoutUrl && prev.status === "pending") return prev.checkoutUrl;
  if (prev?.status === "authorized") throw new Error("Ya tenés una suscripción autorizada. Estamos esperando la confirmación del pago.");
  if (prev?.status === "creating" && Date.now() - prev.updatedAt < 120_000) throw new Error("Tu pago se está preparando. Probá en un momento.");
  const reference = prev?.status === "creating" ? prev.reference : randomUUID();
  const reservation: Subscription = { id: "", reference, status: "creating", updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) };
  if (!(await compareAndSetJson(key(email), prev?.updatedAt ?? 0, reservation)).ok) throw new Error("Tu pago se está preparando. Probá en un momento.");
  // La referencia se genera en el servidor y queda vinculada a la sesión; no se toma el email del webhook.
  await setJson(`maru:billing:ref:${reference}`, { email });
  const sub = await mp<Preapproval>("/preapproval", {
    method: "POST",
    headers: { "X-Idempotency-Key": reference },
    body: JSON.stringify({ reason: "Maru · Plan mensual", external_reference: reference, payer_email: email, back_url: `${SITE_URL}/precios?estado=pendiente`, status: "pending", auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: PLAN_PRICE, currency_id: "ARS" } }),
  });
  if (!sub.id || !sub.init_point || !/^https:\/\/([a-z0-9-]+\.)?mercadopago\.com(\.ar)?\//i.test(sub.init_point)) throw new Error("Mercado Pago no devolvió un link de pago válido.");
  await change(email, (current) => ({ ...current, id: sub.id, status: sub.status, checkoutUrl: sub.init_point }));
  return sub.init_point;
}
export async function refreshSubscription(email: string): Promise<Subscription | null> {
  const current = await readSubscription(email);
  if (!current?.id || !billingReady()) return current;
  const sub = await mp<Preapproval>(`/preapproval/${encodeURIComponent(current.id)}`);
  if (sub.external_reference !== current.reference) throw new Error("La suscripción no coincide.");
  await change(email, (s) => s.reference === sub.external_reference ? { ...s, status: sub.status } : s);
  // Recupera la confirmación si el webhook se demoró o no llegó. El pago se verifica por la misma vía.
  const invoices = await mp<{ results: Invoice[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(current.id)}&limit=50`);
  const latest = invoices.results.filter((invoice) => invoice.payment?.id).sort((a,b) => Number(b.id) - Number(a.id)).slice(0,3);
  for (const invoice of latest) await processNotification("subscription_authorized_payment", String(invoice.id));
  return readSubscription(email);
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
  if (!current || current.reference !== sub.external_reference || (current.id && current.id !== sub.id)) return;
  if (invoice?.payment?.id) payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
  if (payment) await setJson(`maru:billing:payment:${payment.id}`, { subId: sub.id });
  await change(binding.email, (s) => {
    if (s.reference !== sub.external_reference) return s;
    const next = { ...s, id: sub.id, status: sub.status };
    if (!payment) return next; // Autorizar el débito no equivale a cobrarlo.
    const at = Date.parse(payment.date_approved);
    if (payment.transaction_amount !== PLAN_PRICE || payment.currency_id !== "ARS" || !Number.isFinite(at) || at > Date.now() + 60_000) return next;
    if (payment.status === "approved" && !payment.transaction_amount_refunded) {
      if (at < (s.paymentAt ?? 0)) return next;
      const end = new Date(at);
      const day = end.getUTCDate();
      end.setUTCDate(1);
      end.setUTCMonth(end.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
      end.setUTCDate(Math.min(day, lastDay));
      return { ...next, paymentId: payment.id, paymentAt: at, paidThrough: end.getTime() };
    }
    if (s.paymentId === payment.id) return { ...next, paidThrough: 0 };
    return next;
  });
}
export async function allowUsage(email: string, kind: UsageKind): Promise<boolean> {
  if (!BILLING_ENABLED) return true;
  if (!billingReady()) throw new Error("No pudimos verificar tu plan.");
  const paid = hasPaidAccess(await readSubscription(email));
  const month = new Date().toISOString().slice(0, 7);
  return (await takeCounter(`maru:usage:${userId(email)}:${month}:${paid ? "plan" : kind}`, paid ? PAID_MONTHLY_LIMIT : FREE_LIMITS[kind], 32 * 86400_000)) === 0;
}
