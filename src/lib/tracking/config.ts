/**
 * Configuración de Google Ads (etiqueta de Google cargada directamente, sin GTM).
 * Los IDs y labels de conversión del navegador no son secretos: van en variables NEXT_PUBLIC_* de Vercel
 * (se fijan al compilar, así que cambiarlos exige un nuevo deploy). Ver docs/TRACKING.md.
 *
 * Sin NEXT_PUBLIC_GOOGLE_ADS_ID la etiqueta no se carga y ninguna conversión sale del navegador.
 */

export type AdsConversion = "activation" | "paywall" | "begin_checkout" | "purchase";

/** Acción de conversión de Google Ads que corresponde a cada evento (nombres exactos de la cuenta). */
export const ADS_ACTION_NAMES: Record<AdsConversion, string> = {
  activation: "Maru | Activación",
  paywall: "Maru | Límite alcanzado",
  begin_checkout: "Maru | Inicio de checkout",
  purchase: "Maru | Compra confirmada",
};

const AW_ID = /^AW-\d{6,15}$/;
const LABEL = /^[A-Za-z0-9_-]{8,40}$/;

/** Next reemplaza `process.env.NEXT_PUBLIC_*` al compilar sólo si se escribe literal: por eso cada variable va por separado. */
function raw() {
  return {
    id: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
    labels: {
      activation: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_ACTIVATION,
      paywall: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PAYWALL,
      begin_checkout: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_BEGIN_CHECKOUT,
      purchase: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_PURCHASE,
    } as Record<AdsConversion, string | undefined>,
    hosts: process.env.NEXT_PUBLIC_GOOGLE_ADS_HOSTS,
  };
}

export const DEFAULT_ADS_HOSTS = ["www.marucoach.com", "marucoach.com"];

export type AdsConfig = {
  /** "AW-…" válido, o null si la etiqueta está apagada. */
  id: string | null;
  /** send_to ("AW-…/label") de cada conversión; null si falta o es inválido. */
  sendTo: Record<AdsConversion, string | null>;
  /** Dominios de producción donde se carga la etiqueta y se envían conversiones. */
  hosts: string[];
};

export function parseAdsConfig(env: ReturnType<typeof raw>): AdsConfig {
  const id = env.id?.trim() ?? "";
  const valid = AW_ID.test(id) ? id : null;
  const sendTo = Object.fromEntries(
    (Object.keys(ADS_ACTION_NAMES) as AdsConversion[]).map((k) => {
      const label = env.labels[k]?.trim() ?? "";
      return [k, valid && LABEL.test(label) ? `${valid}/${label}` : null];
    }),
  ) as Record<AdsConversion, string | null>;
  const hosts = (env.hosts ?? "")
    .split(/[\s,]+/)
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9.-]+$/.test(h));
  return { id: valid, sendTo, hosts: hosts.length ? hosts : DEFAULT_ADS_HOSTS };
}

export const adsConfig = (): AdsConfig => parseAdsConfig(raw());

/** Sólo en estos dominios se carga gtag.js y se envían conversiones (nunca localhost ni previews de Vercel). */
export const isAdsHost = (hostname: string, config = adsConfig()) => config.hosts.includes(hostname.toLowerCase());

/**
 * Píxel de Meta de Maru (también cargado directo, sin GTM). No es secreto: va en el código, y NEXT_PUBLIC_META_PIXEL_ID
 * lo reemplaza. Con un ID inválido el píxel no se carga. Usa los mismos dominios de producción que la etiqueta de Google.
 */
const PIXEL_ID = /^\d{10,20}$/;
export function parseMetaPixelId(raw: string | undefined): string | null {
  const id = raw?.trim() ?? "";
  return PIXEL_ID.test(id) ? id : null;
}
/** Conjunto de datos "Maru Coach" (negocio Costa Reset). Es público: viaja igual al navegador. La variable lo reemplaza si hace falta. */
export const DEFAULT_META_PIXEL_ID = "1466577088716669";
export const metaPixelId = (): string | null => parseMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID || DEFAULT_META_PIXEL_ID);
