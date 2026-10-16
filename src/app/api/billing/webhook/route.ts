import { billingJson } from "@/lib/billing/http";
import { validWebhook } from "@/lib/billing/provider";
import { billingReady, processNotification } from "@/lib/billing/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!billingReady()) return billingJson({ code: "BILLING_DISABLED" }, 503);
  // Se firma el ID del query, tal como lo entrega Mercado Pago; el cuerpo no puede cambiarlo.
  const id = new URL(req.url).searchParams.get("data.id") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !validWebhook(req, id)) return billingJson({ code: "INVALID_SIGNATURE" }, 401);
  const body = await req.json().catch(() => null) as { type?: string; data?: { id?: string | number } } | null;
  if (!body || (body.data?.id != null && String(body.data.id) !== id)) return billingJson({ code: "BAD_REQUEST" }, 400);
  try { await processNotification(body.type ?? "", id); return billingJson({ ok: true }); }
  catch (err) {
    console.error("[billing webhook]", err instanceof Error ? err.message : "error");
    return billingJson({ code: "RETRY" }, 503);
  }
}
