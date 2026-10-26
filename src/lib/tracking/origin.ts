/**
 * Origen comercial: por qué la persona llegó a los planes. Viaja como `origen_oferta` en los eventos de producto
 * (plan_click, checkout_creado, checkout_error, compra_confirmada…) para separar en PostHog el funnel de la oferta
 * anticipada del de los límites reales. Nunca sale a Google Ads ni a Meta.
 *
 * - primera_descarga: la oferta anticipada antes de la primera descarga gratis.
 * - limite_real: el cupo gratis frenó una acción (429 PLAN_LIMIT).
 * - funcion_plan: tocó una función del plan pago (402 PLAN_FEATURE).
 * - menu_planes: entró a /precios por su cuenta.
 * - otro: no sabemos (otro dispositivo, almacenamiento borrado, compra conciliada sin checkout en este navegador).
 *
 * Se guarda en este navegador (localStorage, sin datos personales). Al crear el checkout el origen queda fijo para
 * esa compra: Mercado Pago vuelve a /precios y eso no debe pisar el origen real.
 */
export const ORIGENES = ["primera_descarga", "limite_real", "funcion_plan", "menu_planes", "otro"] as const;
export type OrigenOferta = (typeof ORIGENES)[number];

const CURRENT_KEY = "maru:origen:actual";
const CHECKOUT_KEY = "maru:origen:checkout";
/** El origen de una exposición a los planes vale mientras la persona sigue ahí (p. ej. pasa del modal a /precios). */
export const CURRENT_MAX_AGE = 30 * 60_000;
/** El de un checkout, lo que tarda Mercado Pago en acreditar el primer pago y la persona en volver. */
export const CHECKOUT_MAX_AGE = 7 * 86400_000;

type Stored = { origen: OrigenOferta; at: number };

const isOrigen = (v: unknown): v is OrigenOferta => typeof v === "string" && (ORIGENES as readonly string[]).includes(v);

function read(key: string, maxAge: number, now: number): OrigenOferta | null {
  try {
    const raw = window.localStorage.getItem(key);
    const v = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
    return v && isOrigen(v.origen) && typeof v.at === "number" && now - v.at >= 0 && now - v.at <= maxAge ? v.origen : null;
  } catch {
    return null;
  }
}
function write(key: string, origen: OrigenOferta, now: number) {
  try { window.localStorage.setItem(key, JSON.stringify({ origen, at: now } satisfies Stored)); } catch { /* sin almacenamiento */ }
}

/** Los planes quedaron en pantalla por este motivo. */
export function setOrigen(origen: OrigenOferta, now = Date.now()): void {
  write(CURRENT_KEY, origen, now);
}

/** Origen de la exposición en curso; sin una reciente, la persona llegó a los planes por su cuenta. */
export function currentOrigen(now = Date.now()): OrigenOferta {
  return read(CURRENT_KEY, CURRENT_MAX_AGE, now) ?? "menu_planes";
}

/** Si no hay una exposición reciente, /precios cuenta como entrada por el menú. Si la hay, la respeta. */
export function ensureOrigen(fallback: OrigenOferta, now = Date.now()): OrigenOferta {
  const cur = read(CURRENT_KEY, CURRENT_MAX_AGE, now);
  if (cur) return cur;
  setOrigen(fallback, now);
  return fallback;
}

/** El servidor creó el checkout: su origen queda fijo hasta que se confirme el pago. */
export function freezeCheckoutOrigen(origen: OrigenOferta, now = Date.now()): void {
  write(CHECKOUT_KEY, origen, now);
}

/** Origen de la compra que se está confirmando (el del último checkout de este navegador). */
export function checkoutOrigen(now = Date.now()): OrigenOferta {
  return read(CHECKOUT_KEY, CHECKOUT_MAX_AGE, now) ?? "otro";
}
