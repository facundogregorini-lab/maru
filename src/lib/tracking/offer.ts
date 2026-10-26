/**
 * Oferta anticipada de Maru Pro antes de la primera descarga gratis (navegador).
 *
 * Sólo eventos de producto (PostHog y Vercel Analytics, vía trackProduct). A propósito NO usa claimFirst ni
 * sendAdsConversion: ver la oferta no es un límite, no es una activación y no es una conversión de Google Ads
 * ni de Meta. limite_planes_visto y el hito "paywall" quedan sólo para el límite real y las funciones pagas.
 */
import { trackProduct } from "./analytics";
import { setOrigen } from "./origin";

export type OfferResult = "cv" | "carta";
export type OfferExposure = { exposureId: string; tipo: OfferResult };
export type OfferSkipReason = "descarga_gratis" | "cerrar_modal" | "escape" | "click_fuera" | "planes_descarga_gratis" | "planes_cerrar";

const EXPOSURE_ID = /^[A-Za-z0-9-]{8,40}$/;
/** Cuentas para las que ya se decidió en esta pestaña: la próxima descarga no vuelve a consultar. */
const decided = new Set<string>();
const inFlight = new Map<string, Promise<OfferExposure | null>>();

/**
 * Pregunta al servidor si corresponde la oferta antes de esta descarga. Devuelve null ante cualquier duda
 * (sin sesión, error, red lenta): la descarga nunca espera más de `timeoutMs`.
 */
export function requestFirstDownloadOffer(email: string | null | undefined, tipo: OfferResult, timeoutMs = 1500): Promise<OfferExposure | null> {
  if (!email || typeof window === "undefined" || decided.has(email)) return Promise.resolve(null);
  const pending = inFlight.get(email);
  if (pending) return pending.then(() => null); // doble clic: sólo el primero puede abrir la oferta
  const run = (async (): Promise<OfferExposure | null> => {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    try {
      const res = await fetch("/api/billing/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Maru-Account": email },
        body: JSON.stringify({ tipo }),
        signal: ctrl?.signal,
      });
      const body = (await res.json().catch(() => null)) as { show?: unknown; exposureId?: unknown; reason?: unknown } | null;
      // Respuesta definitiva del servidor (mostrar o no): no se vuelve a preguntar en esta pestaña.
      if (res.ok) decided.add(email);
      if (res.ok && body?.show === true && typeof body.exposureId === "string" && EXPOSURE_ID.test(body.exposureId)) return { exposureId: body.exposureId, tipo };
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();
  inFlight.set(email, run);
  void run.finally(() => inFlight.delete(email));
  return run;
}

const sent = new Set<string>();
/** Cada evento sale una sola vez por exposición, aunque React vuelva a renderizar o un callback se repita. */
function once(event: "oferta_pro_vista" | "oferta_pro_click" | "oferta_pro_omitida", exposureId: string): boolean {
  const key = `${event}:${exposureId}`;
  if (sent.has(key)) return false;
  sent.add(key);
  return true;
}

export function trackOfferViewed(exp: OfferExposure, authenticated: boolean): void {
  if (!once("oferta_pro_vista", exp.exposureId)) return;
  trackProduct("oferta_pro_vista", { origen_oferta: "primera_descarga", tipo_resultado: exp.tipo, usuario_autenticado: authenticated, exposure_id: exp.exposureId });
}

/** «Conocer Maru Pro»: desde acá, plan_click y checkout llevan origen_oferta=primera_descarga. */
export function trackOfferClick(exp: OfferExposure): void {
  setOrigen("primera_descarga");
  if (!once("oferta_pro_click", exp.exposureId)) return;
  trackProduct("oferta_pro_click", { origen_oferta: "primera_descarga", tipo_resultado: exp.tipo, exposure_id: exp.exposureId });
}

export function trackOfferSkipped(exp: OfferExposure, motivo: OfferSkipReason): void {
  if (!once("oferta_pro_omitida", exp.exposureId)) return;
  trackProduct("oferta_pro_omitida", { origen_oferta: "primera_descarga", tipo_resultado: exp.tipo, exposure_id: exp.exposureId, motivo });
}

/** Sólo para tests. */
export function resetOfferState(): void {
  decided.clear();
  inFlight.clear();
  sent.clear();
}
