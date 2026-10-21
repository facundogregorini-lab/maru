import { billingJson } from "@/lib/billing/http";
import { recordBillingEvent } from "@/lib/billing/log";
import { webhookProblem } from "@/lib/billing/provider";
import { billingReady, processNotification } from "@/lib/billing/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const url = new URL(req.url);
  const queryType = (url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "").slice(0, 60);
  if (!billingReady()) { await recordBillingEvent({ source: "webhook", type: queryType, result: "cobro apagado" }); return billingJson({ code: "BILLING_DISABLED" }, 503); }
  // Se firma el ID del query, tal como lo entrega Mercado Pago; el cuerpo no puede cambiarlo.
  const id = url.searchParams.get("data.id") ?? "";
  const problem = /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? webhookProblem(req, id) : "sin data.id en la URL";
  if (problem) { await recordBillingEvent({ source: "webhook", type: queryType, result: "rechazada", detail: problem }); return billingJson({ code: "INVALID_SIGNATURE" }, 401); }
  const body = await req.json().catch(() => null) as { type?: string; data?: { id?: string | number } } | null;
  if (!body || (body.data?.id != null && String(body.data.id) !== id)) { await recordBillingEvent({ source: "webhook", type: queryType, result: "rechazada", detail: "cuerpo inválido o con otro id" }); return billingJson({ code: "BAD_REQUEST" }, 400); }
  const type = body.type ?? "";
  const notes: string[] = [];
  try {
    const skipped = await processNotification(type, id, (what) => notes.push(what));
    await recordBillingEvent({ source: "webhook", type, result: skipped ? "pago sin acreditar" : "procesada", detail: skipped ?? notes.join(" · ") });
    return billingJson({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "error";
    console.error("[billing webhook]", detail);
    await recordBillingEvent({ source: "webhook", type, result: "error, Mercado Pago reintenta", detail });
    return billingJson({ code: "RETRY" }, 503);
  }
}
