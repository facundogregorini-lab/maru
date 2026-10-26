/**
 * Capa central de medición de Maru (navegador). Separa:
 *  A) eventos de producto (analytics.ts): pueden repetirse y llevan más detalle;
 *  B) conversiones de Google Ads (ads.ts): una por cuenta (activación, primer límite), una por checkout_id
 *     o por pago verificado, según las reglas de docs/TRACKING.md. Cada una sale también al píxel de Meta
 *     (meta.ts) en el mismo momento y con la misma deduplicación.
 * Ninguna función recibe ni envía emails, nombres, CVs ni cartas: el email sólo viaja a nuestro servidor
 * (cabecera X-Maru-Account, como el resto de la cuenta) para deduplicar por cuenta.
 */
import { adsBlocked, adsDecision, adsMode, sendAdsConversion as sendRaw, type AdsParams, type AdsResult } from "./ads";
import { sendMetaEvent } from "./meta";
import type { AdsConversion } from "./config";
import { trackProduct } from "./analytics";
import type { Milestone } from "./server";
import type { LimitedTool, PlanFeature } from "./paywall";
import { checkoutOrigen, currentOrigen, freezeCheckoutOrigen } from "./origin";

export { trackProduct } from "./analytics";

type Email = string | null | undefined;
const LOCAL_PREFIX = "maru:conv:";
const inFlight = new Map<string, Promise<boolean>>();
const seen = new Set<string>();
/** eventID que devolvió el servidor al marcar el hito: el píxel lo repite para que Meta deduplique con la API de conversiones. */
const eventIds = new Map<string, string>();

function localGet(key: string): boolean {
  try { return localStorage.getItem(LOCAL_PREFIX + key) === "1"; } catch { return false; }
}
function localSet(key: string) {
  try { localStorage.setItem(LOCAL_PREFIX + key, "1"); } catch { /* sin almacenamiento */ }
}

/** La sesión (cookie) identifica la cuenta; el email, si se conoce, sólo confirma que es la misma (como en /api/sync). */
async function serverClaim(email: Email, milestone: Milestone, id: string | undefined, mode: "claim" | "check" | "mark"): Promise<{ first: boolean; eventId?: string } | null> {
  try {
    const res = await fetch("/api/tracking/milestone", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(email ? { "X-Maru-Account": email } : {}) },
      body: JSON.stringify({ milestone, id, mode }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { first?: boolean; eventId?: unknown };
    return { first: body.first === true, eventId: typeof body.eventId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(body.eventId) ? body.eventId : undefined };
  } catch {
    return null;
  }
}

/**
 * ¿Es la primera vez de este hito? Con cuenta, lo decide el servidor (persistente entre dispositivos);
 * sin cuenta o sin base, este navegador (localStorage). En modo de prueba sólo consulta: no marca nada.
 */
export function claimFirst(milestone: Milestone, email: Email, id?: string): Promise<boolean> {
  const key = id ? `${milestone}:${id}` : milestone;
  if (seen.has(key)) return Promise.resolve(false);
  const pending = inFlight.get(key);
  if (pending) return pending.then(() => false); // efectos repetidos o dobles clics: sólo el primero cuenta
  const live = adsMode() === "live" && !adsBlocked();
  const run = (async () => {
    // Sin sesión el servidor responde 401 y decide este navegador.
    const claim = await serverClaim(email, milestone, id, live ? "claim" : "check");
    const first = claim ? claim.first : !localGet(key);
    if (claim?.eventId) eventIds.set(key, claim.eventId);
    // En modo de prueba la repetición se simula en esta pestaña (memoria), sin tocar el navegador ni la cuenta.
    seen.add(key);
    if (live) localSet(key);
    return first;
  })();
  inFlight.set(key, run);
  void run.finally(() => inFlight.delete(key));
  return run;
}

/** Al ingresar: los hitos únicos que este navegador ya envió quedan marcados también en la cuenta. */
export async function syncLocalMilestones(email: string): Promise<void> {
  if (adsMode() !== "live" || adsBlocked()) return;
  for (const m of ["activation", "paywall"] as const) if (localGet(m)) await serverClaim(email, m, undefined, "mark");
}

/**
 * Envía a Google Ads y, con la misma decisión, al píxel de Meta. Deja constancia en analytics si una etiqueta
 * estaba bloqueada (no se marca como entregada).
 */
async function sendAdsConversion(conversion: AdsConversion, params?: AdsParams, opts?: { waitMs?: number }): Promise<AdsResult> {
  const eventID = eventIds.get(conversion) ?? params?.transaction_id;
  if (sendMetaEvent(conversion, params ?? {}, adsDecision(conversion, params), eventID) === "blocked") trackProduct("meta_bloqueado", { conversion });
  const result = await sendRaw(conversion, params, opts);
  if (result === "blocked") trackProduct("ads_bloqueado", { conversion });
  return result;
}

// ——— A) + B): eventos del producto y su conversión ———

export type ActivationVia = "descarga_pdf" | "descarga_word" | "copia" | "toma" | "informe";

/** Primer resultado útil: CV descargado, carta copiada o descargada, video grabado, entrevista con informe. */
export async function trackActivation(email: Email, herramienta: LimitedTool, via: ActivationVia): Promise<void> {
  const first = await claimFirst("activation", email);
  trackProduct("activacion", { herramienta, via, primera: first });
  if (first) await sendAdsConversion("activation");
}

/** El cupo gratis frenó una acción y los planes ya están en pantalla. Conversión sólo la primera vez por cuenta. */
export async function trackPaywallViewed(email: Email, herramienta: LimitedTool): Promise<void> {
  const first = await claimFirst("paywall", email);
  trackProduct("limite_planes_visto", { herramienta, primera: first, origen_oferta: "limite_real" });
  if (first) await sendAdsConversion("paywall");
}

/**
 * La persona tocó una función del plan pago y los mismos planes ya están en pantalla. Suma a la misma conversión
 * que el límite (hito "paywall": una sola vez por cuenta entre los dos); en analytics queda aparte.
 */
export async function trackPlanFeatureViewed(email: Email, funcion: PlanFeature): Promise<void> {
  const first = await claimFirst("paywall", email);
  trackProduct("funcion_plan_vista", { funcion, primera: first, origen_oferta: "funcion_plan" });
  if (first) await sendAdsConversion("paywall");
}

/** `origen_oferta`: por qué está viendo los planes (origin.ts). Sólo analytics: plan_click no es una conversión. */
export function trackPlanClick(plan: string): void {
  trackProduct("plan_click", { plan, origen_oferta: currentOrigen() });
}

export function trackCheckoutFailed(plan: string, codigo: string | undefined): void {
  trackProduct("checkout_error", { plan, codigo: codigo ?? "desconocido", origen_oferta: currentOrigen() });
}

/**
 * El servidor creó el checkout de Mercado Pago. Espera la confirmación de la etiqueta hasta `waitMs`
 * antes de que el navegador salga hacia el pago; nunca más que eso.
 */
export async function trackCheckoutCreated(email: Email, plan: string, checkoutId: string, waitMs = 800): Promise<AdsResult | "duplicate"> {
  const started = Date.now();
  const first = await claimFirst("begin_checkout", email, checkoutId);
  const origen = currentOrigen();
  // Mercado Pago vuelve a /precios: el origen de esta compra queda fijo acá.
  freezeCheckoutOrigen(origen);
  trackProduct("checkout_creado", { plan, primera: first, origen_oferta: origen });
  if (!first) return "duplicate";
  return sendAdsConversion("begin_checkout", { transaction_id: `co_${checkoutId}` }, { waitMs: Math.max(150, waitMs - (Date.now() - started)) });
}

/** Pago verificado por el servidor (webhook o reconsulta a Mercado Pago), tal como lo devuelve /api/billing/status. */
export type VerifiedPayment = { id: string; amount: number; currency: string; first: boolean; at: number; plan: string };

const PURCHASE_WINDOW_MS = 30 * 86400_000;

/** Envía la compra una sola vez por pago. Las renovaciones quedan en analytics, no en Ads. */
export async function trackVerifiedPurchase(email: Email, payment: VerifiedPayment | null | undefined, now = Date.now()): Promise<void> {
  if (!payment || !/^\d{1,20}$/.test(payment.id) || !(payment.amount > 0) || now - payment.at > PURCHASE_WINDOW_MS) return;
  const first = await claimFirst("purchase", email, payment.id);
  if (!first) return;
  // El origen sólo describe la primera compra; una renovación no vino de ninguna pantalla.
  trackProduct("compra_confirmada", { plan: payment.plan, renovacion: !payment.first, monto: payment.amount, ...(payment.first ? { origen_oferta: checkoutOrigen() } : {}) });
  if (payment.first && payment.currency === "ARS") await sendAdsConversion("purchase", { value: payment.amount, currency: "ARS", transaction_id: `mp_${payment.id}` });
}
