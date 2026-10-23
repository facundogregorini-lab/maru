import { createHash, randomUUID } from "node:crypto";
import { compareAndSetJson, dbConfigured, getManyJson, setJson, takeCounter, takeCounterCount } from "../db";
import { userId } from "../sync/server";
import { acceptedAmounts, billingEnabled, billingFlagState, firstCharge, FREE_LIMITS, GUARANTEE_DAYS, PAID_DAILY_LIMIT, PLANS, WITHDRAWAL_DAYS, type PlanId, type UsageKind } from "../plans";
import { SITE_URL } from "../site";
import { recordBillingEvent } from "./log";
import { mp, MpError, type Invoice, type Payment, type Preapproval } from "./provider";

/**
 * `plan` falta en suscripciones creadas antes de los tres planes: eran mensuales.
 * `firstPaymentId`: el primer pago acreditado de la suscripción (los siguientes son renovaciones). Falta en
 * suscripciones que ya tenían un pago antes de guardarlo; esas no se informan como primera compra.
 * `paymentLive`: false si Mercado Pago marcó el último pago como de prueba (no se mide como compra).
 * `firstPaymentAt`: cuándo se acreditó el primer pago (cuenta los días de garantía y de arrepentimiento).
 * `paymentAmount`: importe del último pago acreditado (con promo, el primero es menor que las renovaciones).
 * `renewalPriceSet`: con promo de primer período, ya se pasó la suscripción al precio regular en Mercado Pago.
 * `cancelRequest` / `refund`: comprobantes de baja y de devolución, con el número que se le muestra a la persona.
 */
export type Subscription = {
  id: string; reference: string; status: string; plan?: PlanId; checkoutUrl?: string; paidThrough?: number; paymentId?: number; paymentAt?: number;
  firstPaymentId?: number; firstPaymentAt?: number; paymentAmount?: number; paymentLive?: boolean; renewalPriceSet?: boolean;
  cancelRequest?: { id: string; at: number }; refund?: { id: string; at: number; kind: RefundKind; paymentId: number; amount: number };
  updatedAt: number;
};
/** garantia: la de satisfacción de Maru (14 días, primera contratación). arrepentimiento: el derecho legal (10 días). */
export type RefundKind = "garantia" | "arrepentimiento";
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
  return { id: String(sub.paymentId), amount: sub.paymentAmount ?? PLANS[plan].price, currency: "ARS", first: sub.firstPaymentId === sub.paymentId, at: sub.paymentAt, plan };
}

/** Mercado Pago rechazó crear la suscripción. `reason` es su motivo, para el panel y los logs (sin datos personales). */
export class CheckoutRejected extends Error {
  constructor(public cause: MpError) {
    super(cause.message);
  }
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
  // La garantía es para la primera contratación: quien ya pagó una suscripción antes no la vuelve a tener.
  if (prev?.firstPaymentId) await setJson(guaranteeKey(email), { at: Date.now(), recontratacion: true });
  // Un reintento reutiliza la referencia (clave de idempotencia), así que conserva también su plan.
  const retry = prev?.status === "creating";
  const reference = retry ? prev.reference : randomUUID();
  const plan = PLANS[retry ? subscriptionPlan(prev) : planId];
  const reservation: Subscription = { id: "", reference, status: "creating", plan: plan.id, updatedAt: Math.max(Date.now(), (prev?.updatedAt ?? 0) + 1) };
  if (!(await compareAndSetJson(key(email), prev?.updatedAt ?? 0, reservation)).ok) throw new Error("Tu pago se está preparando. Probá en un momento.");
  // La referencia se genera en el servidor y queda vinculada a la sesión; no se toma el email del webhook.
  await setJson(`maru:billing:ref:${reference}`, { email });
  let sub: Preapproval;
  try {
    sub = await mp<Preapproval>("/preapproval", {
      method: "POST",
      headers: { "X-Idempotency-Key": reference },
      body: JSON.stringify({ reason: `Maru · Plan ${plan.nombre.toLowerCase()}`, external_reference: reference, payer_email: email, back_url: `${SITE_URL}/precios?estado=pendiente`, status: "pending", auto_recurring: { frequency: plan.frequency, frequency_type: plan.frequencyType, transaction_amount: firstCharge(plan), currency_id: "ARS" } }),
    });
  } catch (err) {
    // Un rechazo definitivo no creó nada: se libera la reserva para que el próximo intento use una referencia
    // nueva. Si no, quedaba "preparándose" y, al reintentar con la misma clave, Mercado Pago repetía el rechazo.
    if (err instanceof MpError && err.definitive) {
      await change(email, (current) => (current.reference === reference ? { ...current, status: "failed", checkoutUrl: undefined } : current)).catch(() => {});
      await recordBillingEvent({ source: "actualizar", type: "checkout", result: "rechazado por Mercado Pago", detail: `${plan.id}: ${err.status} ${err.reason}`.slice(0, 200) });
      throw new CheckoutRejected(err);
    }
    throw err;
  }
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
/**
 * Promo de primer período: después del primer pago acreditado, la suscripción pasa al precio regular en Mercado Pago.
 * Si falla, queda para la próxima notificación o "Actualizar estado" (nunca se cobra de más: el monto sólo sube una vez).
 */
async function applyRenewalPrice(email: string, note: (what: string) => void): Promise<void> {
  const s = await readSubscription(email);
  if (!s?.id || !s.firstPaymentId || s.renewalPriceSet || s.status === "cancelled" || s.refund) return;
  const plan = PLANS[subscriptionPlan(s)];
  if (!plan.intro) return;
  try {
    await mp<Preapproval>(`/preapproval/${encodeURIComponent(s.id)}`, { method: "PUT", body: JSON.stringify({ auto_recurring: { transaction_amount: plan.price, currency_id: "ARS" } }) });
    await change(email, (cur) => (cur.id === s.id ? { ...cur, renewalPriceSet: true } : cur));
    note("renovación pasada al precio regular");
  } catch (err) {
    note(`no se pudo pasar la renovación al precio regular: ${err instanceof Error ? err.message.slice(0, 80) : "error"}`);
  }
}

/** Número de solicitud que se le muestra a la persona (baja, devolución, arrepentimiento). */
const requestId = (prefix: string) => `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const guaranteeKey = (email: string) => `maru:billing:guarantee:${userId(email)}`;

/** Baja: corta las renovaciones y conserva el acceso hasta el fin del período pago. No devuelve el período en curso. */
export async function cancel(email: string, reason?: string): Promise<{ requestId: string; paidThrough: number | null }> {
  const current = await readSubscription(email);
  if (!current?.id || !billingReady()) throw new Error("No encontramos una suscripción para cancelar.");
  if (current.status === "cancelled" && current.cancelRequest) return { requestId: current.cancelRequest.id, paidThrough: current.paidThrough ?? null };
  const result = await mp<Preapproval>(`/preapproval/${encodeURIComponent(current.id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  if (result.status !== "cancelled") throw new Error("No pudimos confirmar la cancelación.");
  const id = requestId("BAJA");
  const next = await change(email, (s) => ({ ...s, status: "cancelled", checkoutUrl: undefined, cancelRequest: s.cancelRequest ?? { id, at: Date.now() } }));
  await recordBillingEvent({ source: "actualizar", type: "baja", result: "renovación cancelada", detail: reason ? `motivo: ${reason}` : undefined });
  return { requestId: next.cancelRequest?.id ?? id, paidThrough: next.paidThrough ?? null };
}

/**
 * Qué devolución puede pedir hoy, sobre el primer pago de la suscripción:
 * la garantía de 14 días (una vez por cuenta) o, si ya la usó, el arrepentimiento legal de 10 días.
 */
export function refundOption(sub: Subscription | null, guaranteeUsed: boolean, now = Date.now()): { kind: RefundKind; until: number; amount: number } | null {
  if (!sub?.firstPaymentId || !sub.firstPaymentAt || sub.refund || sub.paymentLive === false) return null;
  const amount = sub.paymentId === sub.firstPaymentId ? sub.paymentAmount ?? firstCharge(PLANS[subscriptionPlan(sub)]) : firstCharge(PLANS[subscriptionPlan(sub)]);
  const guaranteeUntil = sub.firstPaymentAt + GUARANTEE_DAYS * 86400_000;
  if (!guaranteeUsed && now <= guaranteeUntil) return { kind: "garantia", until: guaranteeUntil, amount };
  const withdrawalUntil = sub.firstPaymentAt + WITHDRAWAL_DAYS * 86400_000;
  if (now <= withdrawalUntil) return { kind: "arrepentimiento", until: withdrawalUntil, amount };
  return null;
}
export async function readRefundOption(email: string, sub?: Subscription | null) {
  const current = sub === undefined ? await readSubscription(email) : sub;
  if (!current?.firstPaymentId) return null;
  const used = (await getManyJson<{ at: number }>([guaranteeKey(email)]))[0];
  return refundOption(current, !!used);
}

/**
 * Devolución automática del 100% del primer pago: cancela las renovaciones y pide el reembolso a Mercado Pago.
 * El acceso termina si ese pago era el período vigente; si ya hubo una renovación, se conserva lo pagado aparte.
 */
export async function requestRefund(email: string, reason?: string): Promise<{ requestId: string; kind: RefundKind; amount: number }> {
  if (!billingReady()) throw new Error("Los planes no están habilitados.");
  const sub = await readSubscription(email);
  if (sub?.refund) return { requestId: sub.refund.id, kind: sub.refund.kind, amount: sub.refund.amount };
  const option = await readRefundOption(email, sub);
  if (!sub || !option || !sub.firstPaymentId) throw new Error(`La devolución se puede pedir dentro de los ${GUARANTEE_DAYS} días del primer pago.`);
  const id = requestId("DEV");
  if (sub.status !== "cancelled") {
    const result = await mp<Preapproval>(`/preapproval/${encodeURIComponent(sub.id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
    if (result.status !== "cancelled") throw new Error("No pudimos cancelar la renovación. Probá de nuevo en un momento.");
  }
  // La clave de idempotencia es el pago: repetir el pedido no genera un segundo reembolso.
  await mp(`/v1/payments/${encodeURIComponent(String(sub.firstPaymentId))}/refunds`, { method: "POST", headers: { "X-Idempotency-Key": `maru-refund-${sub.firstPaymentId}` }, body: "{}" });
  if (option.kind === "garantia") await setJson(guaranteeKey(email), { at: Date.now() });
  const firstPaymentId = sub.firstPaymentId;
  const next = await change(email, (s) => ({
    ...s,
    status: "cancelled",
    checkoutUrl: undefined,
    cancelRequest: s.cancelRequest ?? { id, at: Date.now() },
    refund: s.refund ?? { id, at: Date.now(), kind: option.kind, paymentId: firstPaymentId, amount: option.amount },
    // Sin renovaciones posteriores, el período devuelto era el vigente: se corta el acceso.
    ...(s.paymentId === firstPaymentId ? { paidThrough: 0 } : {}),
  }));
  await recordBillingEvent({ source: "actualizar", type: option.kind === "garantia" ? "garantía" : "arrepentimiento", result: "reembolso pedido", detail: reason ? `motivo: ${reason}` : undefined });
  return { requestId: next.refund?.id ?? id, kind: option.kind, amount: option.amount };
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
    if (!acceptedAmounts(plan).includes(payment.transaction_amount) || payment.currency_id !== "ARS" || !Number.isFinite(at) || at > Date.now() + 60_000) {
      if (payment.status === "approved") skipped = `Pago aprobado sin acreditar: ${payment.transaction_amount} ${payment.currency_id} (plan ${plan.id}: ${plan.price} ARS), fecha ${Number.isFinite(at) ? "ok" : "inválida"}.`;
      return next;
    }
    if (payment.status === "approved" && !payment.transaction_amount_refunded) {
      if (at < (s.paymentAt ?? 0)) return next;
      // El primer pago acreditado de la suscripción queda guardado: los siguientes son renovaciones.
      const firstPaymentId = s.firstPaymentId ?? (s.paymentId ? undefined : payment.id);
      const firstPaymentAt = s.firstPaymentAt ?? (firstPaymentId === payment.id ? at : undefined);
      return { ...next, paymentId: payment.id, paymentAt: at, paymentAmount: payment.transaction_amount, paidThrough: periodEnd(at, plan.frequency, plan.frequencyType), paymentLive: payment.live_mode !== false, ...(firstPaymentId ? { firstPaymentId } : {}), ...(firstPaymentAt ? { firstPaymentAt } : {}) };
    }
    if (s.paymentId === payment.id) return { ...next, paidThrough: 0 };
    return next;
  });
  await applyRenewalPrice(binding.email, note);
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
/** Tope por IP para el uso gratis sin cuenta: holgado para varias personas en una misma red, pero frena reinstalar la extensión para sumar usos. */
export const ANON_IP_FACTOR = 3;
/**
 * Uso gratis sin cuenta (la extensión de Chrome): cuenta por instalación y, aparte, por IP.
 * Las claves se guardan como SHA-256, nunca la IP ni el identificador.
 */
export async function allowAnonymousUsage(install: string | null, ip: string, kind: UsageKind, now = Date.now()): Promise<boolean> {
  return (await takeAnonymousUsage(install, ip, kind, now)).ok;
}
/** Igual que allowAnonymousUsage, con los usos que quedan en la ventana (null si no se puede saber). */
export async function takeAnonymousUsage(install: string | null, ip: string, kind: UsageKind, now = Date.now()): Promise<{ ok: boolean; remaining: number | null; limit: number }> {
  const { limit, window } = FREE_LIMITS[kind];
  if (!billingReady()) return { ok: true, remaining: null, limit };
  const ttl = (window === "semana" ? 8 : 2) * 86400_000;
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const slot = `${usageWindow(window, now)}:${kind}`;
  const byIp = await takeCounterCount(`maru:usage:anon-ip:${hash(ip)}:${slot}`, limit * ANON_IP_FACTOR, ttl, now);
  if (byIp.wait !== 0) return { ok: false, remaining: 0, limit };
  if (!install) return { ok: true, remaining: Math.max(0, Math.min(limit, limit * ANON_IP_FACTOR - byIp.count)), limit };
  const own = await takeCounterCount(`maru:usage:anon:${hash(install)}:${slot}`, limit, ttl, now);
  return { ok: own.wait === 0, remaining: Math.max(0, limit - own.count), limit };
}
/** Cupo de una cuenta con los usos que quedan. Con plan pago no hay cupo visible: remaining null. */
export async function takeUsage(email: string, kind: UsageKind, now = Date.now()): Promise<{ ok: boolean; remaining: number | null; limit: number }> {
  const { limit, window } = FREE_LIMITS[kind];
  if (!billingReady()) return { ok: true, remaining: null, limit };
  if (await hasPaidPlan(email)) return { ok: await allowUsage(email, kind, now), remaining: null, limit };
  const ttl = (window === "semana" ? 8 : 2) * 86400_000;
  const r = await takeCounterCount(`maru:usage:${userId(email)}:${usageWindow(window, now)}:${kind}`, limit, ttl, now);
  return { ok: r.wait === 0, remaining: Math.max(0, limit - r.count), limit };
}
