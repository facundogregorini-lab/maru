import { createHmac, timingSafeEqual } from "node:crypto";

/** Documentación de endpoints y contrato: docs/COBROS.md. Nunca se confía en el estado recibido por webhook. */
export type Preapproval = { id: string; status: string; external_reference: string; payer_email?: string; init_point?: string; auto_recurring?: { transaction_amount: number; currency_id: string } };
export type Invoice = { id: number; preapproval_id: string; payment?: { id: number }; };
export type Payment = { id: number; status: string; transaction_amount: number; transaction_amount_refunded?: number; currency_id: string; date_approved: string; };
export async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no está configurado.");
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status}.`);
  return res.json() as Promise<T>;
}
export function validWebhook(req: Request, id: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const requestId = req.headers.get("x-request-id");
  const parts = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=")));
  if (!secret || !requestId || !parts.ts || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return false;
  const stamp = Number(parts.ts);
  // Mercado Pago reintenta durante días. Un reintento firmado sigue siendo válido:
  // se reconsulta el recurso actual y la acreditación es idempotente.
  if (!Number.isSafeInteger(stamp) || stamp <= 0) return false;
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}
