/**
 * Eventos de producto (analytics). Salen por Vercel Analytics (window.va) y PostHog (posthog.ts), igual que
 * los eventos del match (src/lib/match/events.ts), y por el evento "maru:event" del navegador para depurar.
 * Pueden repetirse y llevar más detalle que las conversiones publicitarias, pero nunca datos personales:
 * sólo valores de una lista cerrada (herramienta, plan, códigos, montos agregados).
 */
import { capture } from "./posthog";

export type ProductEvent =
  | "activacion" // primer resultado útil de una herramienta (se mide cada vez, con `primera`)
  | "limite_planes_visto" // el cupo gratis frenó una acción y se mostraron los planes
  | "plan_click" // eligió un plan (todavía sin checkout)
  | "checkout_creado" // el servidor creó la suscripción en Mercado Pago
  | "checkout_error" // el clic en un plan no llegó a checkout
  | "compra_confirmada" // pago aprobado verificado por el servidor
  | "ads_bloqueado"; // la etiqueta de Google no cargó (bloqueador, red): la conversión no salió

export type ProductProps = Partial<{
  herramienta: "cv" | "carta" | "video" | "entrevista";
  via: "descarga_pdf" | "descarga_word" | "copia" | "toma" | "informe";
  primera: boolean;
  plan: string;
  codigo: string;
  renovacion: boolean;
  monto: number;
  conversion: string;
}>;

const ALLOWED = new Set(["herramienta", "via", "primera", "plan", "codigo", "renovacion", "monto", "conversion"]);
const SAFE_VALUE = /^[a-z0-9_-]{1,40}$/i;

/** Filtra props: claves conocidas y valores cortos sin texto libre (nunca emails, nombres ni contenido). */
export function safeProps(props: ProductProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!ALLOWED.has(k) || v === undefined) continue;
    if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
    else if (typeof v === "string" && SAFE_VALUE.test(v)) out[k] = v;
  }
  return out;
}

export function trackProduct(event: ProductEvent, props: ProductProps = {}): void {
  if (typeof window === "undefined") return;
  const data = safeProps(props);
  try {
    const va = (window as unknown as { va?: (t: "event", d: { name: string; data?: Record<string, string | number | boolean> }) => void }).va;
    va?.("event", { name: event, data });
    capture(event, data);
    window.dispatchEvent(new CustomEvent("maru:event", { detail: { event, ...data } }));
  } catch {
    // la medición nunca rompe la app
  }
}
