/**
 * Envío de los mismos hitos al píxel de Meta, con la llamada nativa fbq('track' | 'trackCustom', …).
 * No decide nada por su cuenta: sale exactamente cuando la conversión sale a Google Ads (misma deduplicación
 * en index.ts y misma decisión de adsDecision), así las dos plataformas miden los mismos hitos.
 *
 *   activation     → trackCustom maru_core_activation
 *   paywall        → trackCustom maru_paywall_viewed   (base de la conversión personalizada de optimización)
 *   begin_checkout → track InitiateCheckout           (eventID co_<checkoutId>)
 *   purchase       → track Purchase {value, currency} (eventID mp_<payment_id>)
 *
 * Sólo value, currency y el eventID; nunca datos personales. En modo de prueba se registra en window.__maruMeta.
 */
import type { AdsDecision, AdsParams } from "./ads";
import { cleanParams } from "./ads";
import { metaPixelId, type AdsConversion } from "./config";

export type MetaResult = "sent" | "dry_run" | "off" | "blocked";

/** Evento de Meta que corresponde a cada hito. Los estándar conservan la definición del evento de origen. */
export const META_EVENTS: Record<AdsConversion, { name: string; standard: boolean; source: string }> = {
  activation: { name: "maru_core_activation", standard: false, source: "maru_core_activation" },
  paywall: { name: "maru_paywall_viewed", standard: false, source: "maru_paywall_viewed" },
  begin_checkout: { name: "InitiateCheckout", standard: true, source: "maru_begin_checkout" },
  purchase: { name: "Purchase", standard: true, source: "maru_purchase" },
};

type MetaLog = { conversion: AdsConversion; event: string; data: Record<string, unknown>; eventID?: string; result: MetaResult; at: number };
type MetaWindow = Window & { fbq?: (...args: unknown[]) => void; __maruMetaLoaded?: boolean; __maruMeta?: MetaLog[] };

/** fbevents.js no cargó (bloqueador o red). */
export function metaBlocked(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as MetaWindow;
  return w.__maruMetaLoaded === false || typeof w.fbq !== "function";
}

/**
 * Envía el hito a Meta según lo que se decidió para Google (`decision`): "live" lo envía, "dry_run" sólo lo
 * registra, y cualquier otro caso (etiqueta apagada, bloqueada o parámetros inválidos) no lo envía.
 */
export function sendMetaEvent(conversion: AdsConversion, params: AdsParams, decision: AdsDecision): MetaResult {
  if (typeof window === "undefined" || !metaPixelId()) return "off";
  const w = window as MetaWindow;
  const { name, standard } = META_EVENTS[conversion];
  const clean = cleanParams(params) ?? {};
  const data: Record<string, unknown> = {};
  if (clean.value !== undefined) Object.assign(data, { value: clean.value, currency: clean.currency });
  const eventID = clean.transaction_id;
  const done = (result: MetaResult) => {
    (w.__maruMeta ??= []).push({ conversion, event: name, data, eventID, result, at: Date.now() });
    if (result === "dry_run") console.info("[maru:meta]", name, result, data, eventID ?? "");
    return result;
  };
  if (decision === "dry_run") return done("dry_run");
  if (decision !== "live") return done("off");
  if (metaBlocked()) return done("blocked");
  try {
    w.fbq!(standard ? "track" : "trackCustom", name, data, eventID ? { eventID } : undefined);
    return done("sent");
  } catch {
    return done("blocked");
  }
}
