import { billingJson } from "@/lib/billing/http";
import { readBillingEvents } from "@/lib/billing/log";
import { mp } from "@/lib/billing/provider";
import { billingMissing, billingReady } from "@/lib/billing/server";
import { adminDenied } from "@/lib/match/admin";
export const runtime = "nodejs";
/** Diagnóstico del cobro para el panel: qué falta, qué tipo de credencial hay y las últimas notificaciones. Nunca devuelve valores de claves. */
export async function GET(req: Request) {
  const denied = adminDenied(req); if (denied) return denied;
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  const tokenKind = !token ? "falta" : token.startsWith("TEST-") ? "de prueba" : token.startsWith("APP_USR-") ? "productiva" : "formato desconocido";
  let account: { ok: boolean; site?: string; error?: string } = { ok: false, error: "sin credencial" };
  if (token) {
    try { const me = await mp<{ site_id?: string }>("/users/me"); account = { ok: true, site: me.site_id }; }
    catch (err) { account = { ok: false, error: err instanceof Error ? err.message : "error" }; }
  }
  let events: Awaited<ReturnType<typeof readBillingEvents>> = [];
  try { events = await readBillingEvents(); } catch {}
  return billingJson({ ready: billingReady(), missing: billingMissing(), tokenKind, account, events });
}
