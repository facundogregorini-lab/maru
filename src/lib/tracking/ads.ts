/**
 * Envío de conversiones a Google Ads con la llamada nativa de la etiqueta de Google:
 *   gtag('event', 'conversion', { send_to: 'AW-ID/LABEL', ... })
 * Sólo parámetros admitidos y necesarios (value, currency, transaction_id). Nunca datos personales.
 *
 * Modo de prueba: fuera de los dominios de producción, o con ?maru_ads_debug=1 (queda en la pestaña
 * hasta ?maru_ads_debug=0), las conversiones NO se envían: se registran en window.__maruAds y en la consola.
 * Que una llamada se registre o se envíe no significa que Google la haya atribuido.
 */
import { adsConfig, isAdsHost, type AdsConversion, type AdsConfig } from "./config";

export type AdsParams = { value?: number; currency?: "ARS"; transaction_id?: string };
export type AdsResult =
  | "sent" // la etiqueta confirmó el envío (event_callback)
  | "queued" // se pidió el envío pero la confirmación no llegó a tiempo
  | "dry_run" // modo de prueba: no salió
  | "off" // sin ID/label configurado
  | "blocked" // gtag.js no cargó (bloqueador o red): no salió
  | "invalid"; // parámetros fuera de formato: no salió

type LogEntry = { conversion: AdsConversion; send_to: string | null; params: AdsParams; result: AdsResult; at: number };
type AdsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  __maruAdsLoaded?: boolean;
  __maruAds?: LogEntry[];
};

const DEBUG_KEY = "maru:ads:debug";
const TX_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Lee ?maru_ads_debug=1|0 y lo recuerda en la pestaña. */
export function adsDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("maru_ads_debug");
    if (q === "1") sessionStorage.setItem(DEBUG_KEY, "1");
    if (q === "0") sessionStorage.removeItem(DEBUG_KEY);
    return sessionStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

/** Valida y deja sólo los parámetros admitidos. null si algo no tiene el formato esperado. */
export function cleanParams(params: AdsParams): AdsParams | null {
  const out: AdsParams = {};
  if (params.value !== undefined) {
    if (!Number.isFinite(params.value) || params.value < 0) return null;
    out.value = Math.round(params.value * 100) / 100;
    if (params.currency !== "ARS") return null;
    out.currency = "ARS";
  }
  if (params.transaction_id !== undefined) {
    if (!TX_ID.test(params.transaction_id)) return null;
    out.transaction_id = params.transaction_id;
  }
  return out;
}

/** Cómo se trataría una conversión en este navegador, sin enviarla. */
export function adsMode(config: AdsConfig = adsConfig()): "live" | "dry_run" | "off" {
  if (typeof window === "undefined" || !config.id) return "off";
  if (!isAdsHost(window.location.hostname, config) || adsDebug()) return "dry_run";
  return "live";
}

/** gtag.js no cargó (bloqueador o red). Mientras sea así, no se consume la deduplicación. */
export function adsBlocked(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as AdsWindow;
  return w.__maruAdsLoaded === false || typeof w.gtag !== "function";
}

function log(entry: LogEntry) {
  const w = window as AdsWindow;
  (w.__maruAds ??= []).push(entry);
  if (entry.result === "dry_run" || adsDebug()) console.info("[maru:ads]", entry.conversion, entry.result, entry.send_to, entry.params);
}

/**
 * Envía una conversión. `waitMs`: espera la confirmación de la etiqueta hasta ese tiempo (para no
 * perder el envío al navegar fuera del sitio) y siempre resuelve, aunque no llegue: nunca traba al usuario.
 */
export function sendAdsConversion(conversion: AdsConversion, params: AdsParams = {}, opts: { waitMs?: number } = {}): Promise<AdsResult> {
  if (typeof window === "undefined") return Promise.resolve("off");
  const config = adsConfig();
  const sendTo = config.sendTo[conversion];
  const clean = cleanParams(params);
  const mode = adsMode(config);
  const done = (result: AdsResult) => {
    log({ conversion, send_to: sendTo, params: clean ?? params, result, at: Date.now() });
    return result;
  };
  if (!clean) return Promise.resolve(done("invalid"));
  if (!sendTo || mode === "off") return Promise.resolve(done("off"));
  if (mode === "dry_run") return Promise.resolve(done("dry_run"));
  const w = window as AdsWindow;
  if (adsBlocked()) return Promise.resolve(done("blocked"));

  return new Promise<AdsResult>((resolve) => {
    let settled = false;
    const finish = (result: AdsResult) => {
      if (settled) return;
      settled = true;
      resolve(done(result));
    };
    const timer = setTimeout(() => finish("queued"), opts.waitMs ?? 3000);
    try {
      w.gtag!("event", "conversion", {
        send_to: sendTo,
        ...clean,
        event_callback: () => {
          clearTimeout(timer);
          finish("sent");
        },
      });
    } catch {
      clearTimeout(timer);
      finish("blocked");
    }
  });
}
