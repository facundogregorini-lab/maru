import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { cancel } from "@/lib/billing/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  try { await cancel(email); return billingJson({ ok: true }); }
  catch { return billingJson({ error: "No pudimos confirmar la cancelación. Reintentá o cancelá desde Mercado Pago.", code: "CANCEL_FAILED" }, 502); }
}
