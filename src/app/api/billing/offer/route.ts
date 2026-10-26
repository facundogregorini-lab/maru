import { billingJson, billingSession } from "@/lib/billing/http";
import { claimFirstDownloadOffer, isOfferType } from "@/lib/billing/offer";

export const runtime = "nodejs";

/**
 * ¿Mostrar la oferta de Maru Pro antes de esta descarga gratis? Exige sesión (descargar ya la exige).
 * Responde siempre 200 con { show } salvo sin sesión o con un pedido mal armado: ante cualquier falla, show=false
 * y la descarga sigue. No consume cupo ni marca hitos de conversión publicitaria.
 */
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return billingJson({ show: false, code: "AUTH_REQUIRED" }, 401);
  const body = (await req.json().catch(() => null)) as { tipo?: unknown } | null;
  if (!isOfferType(body?.tipo)) return billingJson({ show: false, code: "BAD_REQUEST" }, 400);
  try {
    const decision = await claimFirstDownloadOffer(email, body.tipo);
    return billingJson(decision.show ? { show: true, exposureId: decision.exposureId } : { show: false, reason: decision.reason });
  } catch {
    return billingJson({ show: false, reason: "error" });
  }
}
