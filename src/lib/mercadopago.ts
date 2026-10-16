import { createHmac, timingSafeEqual } from "node:crypto";
import { PLAN_PRICE_ARS, type PlanStatus } from "./account";

/**
 * Suscripción mensual con Mercado Pago (API de suscripciones sin plan asociado, "preapproval").
 * Variables: MP_ACCESS_TOKEN (credenciales de producción de la aplicación) y MP_WEBHOOK_SECRET
 * (Tus integraciones → Webhooks → "Clave secreta"; el webhook apunta a `<sitio>/api/pagos/webhook`
 * con el evento "Planes y suscripciones").
 */

const API = "https://api.mercadopago.com";
export const mpEnabled = () => !!process.env.MP_ACCESS_TOKEN;

type Preapproval = { id: string; status: PlanStatus; external_reference?: string; payer_email?: string; init_point?: string; date_created?: string };

async function mp<T>(path: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(`[mercadopago] ${res.status} ${data.message ?? ""}`.trim());
  return data;
}

/** Crea la suscripción de esta persona y devuelve el link de pago de Mercado Pago. */
export function createSubscription(email: string, backUrl: string, fetchImpl?: typeof fetch) {
  return mp<Preapproval>(
    "/preapproval",
    {
      method: "POST",
      body: JSON.stringify({
        reason: "Plan Maru · tu coach de carrera con IA",
        external_reference: email,
        payer_email: email,
        back_url: backUrl,
        status: "pending",
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: PLAN_PRICE_ARS, currency_id: "ARS" },
      }),
    },
    fetchImpl,
  );
}

export const getSubscription = (id: string, fetchImpl?: typeof fetch) => mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, {}, fetchImpl);

export const cancelSubscription = (id: string, fetchImpl?: typeof fetch) =>
  mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) }, fetchImpl);

/**
 * Firma del webhook: x-signature = "ts=…,v1=…", HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
 * Sin MP_WEBHOOK_SECRET no se puede validar: igual consultamos el estado real en la API antes de cambiar un plan.
 */
export function validSignature(headers: Headers, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  const sig = headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${headers.get("x-request-id") ?? ""};ts:${parts.ts};`;
  const expected = Buffer.from(createHmac("sha256", secret).update(manifest).digest("hex"));
  const given = Buffer.from(parts.v1);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
