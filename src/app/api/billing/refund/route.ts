import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { requestRefund } from "@/lib/billing/server";
export const runtime = "nodejs";
const REASONS = new Set(["precio", "no-me-sirvio", "consegui-trabajo", "pausa", "otro"]);
/** Garantía de 14 días o arrepentimiento: reembolso automático del primer pago y baja de las renovaciones. */
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" && REASONS.has(body.reason) ? body.reason : undefined;
  try { return billingJson({ ok: true, ...(await requestRefund(email, reason)) }); }
  catch (err) {
    const message = err instanceof Error && !err.message.startsWith("Mercado Pago respondió") ? err.message : "No pudimos pedir la devolución. Probá de nuevo en un momento.";
    return billingJson({ error: message, code: "REFUND_FAILED" }, 502);
  }
}
