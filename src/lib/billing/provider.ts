import { createHmac, timingSafeEqual } from "node:crypto";

/** Documentación de endpoints y contrato: docs/COBROS.md. Nunca se confía en el estado recibido por webhook. */
export type Preapproval = { id: string; status: string; external_reference: string; payer_email?: string; init_point?: string; auto_recurring?: { transaction_amount: number; currency_id: string } };
export type Invoice = { id: number; preapproval_id: string; payment?: { id: number }; };
/** `live_mode` es false en pagos hechos con credenciales de prueba. */
export type Payment = { id: number; status: string; transaction_amount: number; transaction_amount_refunded?: number; currency_id: string; date_approved: string; live_mode?: boolean };
export async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no está configurado.");
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  // Sólo la ruta, sin query ni IDs: alcanza para saber qué consulta falló sin dejar datos en los logs.
  if (!res.ok) throw new MpError(res.status, path.split("?")[0].replace(/\/[^/]*\d[^/]*/g, "/:id"), mpReason(await res.json().catch(() => null)));
  return res.json() as Promise<T>;
}

/** Error de Mercado Pago con el código HTTP y el motivo que informa (sin emails ni datos de pago). */
export class MpError extends Error {
  constructor(public status: number, public route: string, public reason: string) {
    super(`Mercado Pago respondió ${status} en ${route}.${reason ? ` Motivo: ${reason}` : ""}`);
  }
  /** Rechazo definitivo (datos inválidos): reintentar con lo mismo no cambia nada. 429 y 5xx pueden ser pasajeros. */
  get definitive() {
    return this.status >= 400 && this.status < 500 && this.status !== 429 && this.status !== 408;
  }
}

/** El motivo que devuelve Mercado Pago (message, error y cause[].description), recortado y sin emails. */
export function mpReason(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as { message?: unknown; error?: unknown; cause?: unknown };
  const causes = Array.isArray(b.cause) ? b.cause.map((c) => (c && typeof c === "object" ? [(c as { code?: unknown }).code, (c as { description?: unknown }).description].filter(Boolean).join(" ") : String(c))) : [];
  const text = [b.message, b.error, ...causes].filter((x) => typeof x === "string" || typeof x === "number").map(String).join(" · ");
  return text.replace(/[^\s@]+@[^\s@]+/g, "[email]").slice(0, 300);
}
export const validWebhook = (req: Request, id: string): boolean => webhookProblem(req, id) === null;
/** Por qué no vale la firma (null si vale), para el registro del panel. No incluye valores de las cabeceras. */
export function webhookProblem(req: Request, id: string): string | null {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const requestId = req.headers.get("x-request-id");
  const parts = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=")));
  if (!secret) return "falta MERCADOPAGO_WEBHOOK_SECRET";
  if (!req.headers.get("x-signature")) return "sin x-signature (¿notificación IPN sin firma?)";
  if (!requestId) return "sin x-request-id";
  if (!parts.ts || !/^[a-f0-9]{64}$/i.test(parts.v1 ?? "")) return "x-signature con otro formato";
  const stamp = Number(parts.ts);
  // Mercado Pago reintenta durante días. Un reintento firmado sigue siendo válido:
  // se reconsulta el recurso actual y la acreditación es idempotente.
  if (!Number.isSafeInteger(stamp) || stamp <= 0) return "ts inválido";
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex")) ? null : "la firma no coincide (¿clave secreta de otra aplicación o de prueba?)";
}
