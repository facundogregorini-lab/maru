import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { cancel } from "@/lib/billing/server";
export const runtime = "nodejs";
/** Motivos opcionales de baja: se guardan sólo como categoría, sin texto libre ni datos personales. */
const REASONS = new Set(["precio", "no-me-sirvio", "consegui-trabajo", "pausa", "otro"]);
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === "string" && REASONS.has(body.reason) ? body.reason : undefined;
  try { return billingJson({ ok: true, ...(await cancel(email, reason)) }); }
  catch { return billingJson({ error: "No pudimos confirmar la cancelación. Reintentá o cancelá desde Mercado Pago.", code: "CANCEL_FAILED" }, 502); }
}
