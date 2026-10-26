/**
 * Puente entre la respuesta del servidor y el modal de planes: cuando una acción choca con el cupo
 * gratis (429 PLAN_LIMIT de src/lib/billing/http.ts, la misma lógica que cobra el producto), avisamos
 * con un evento del navegador y el modal muestra los planes. Lo mismo al tocar una función del plan pago
 * (402 PLAN_FEATURE). No cuenta los frenos por exceso de uso
 * (RATE_LIMIT), los errores técnicos ni las visitas voluntarias a /precios.
 */

export type LimitedTool = "cv" | "carta" | "video" | "entrevista";
export const PLAN_LIMIT_EVENT = "maru:plan-limit";

/** Rutas que consumen cupo gratis (planGuard con tipo) y la herramienta de cada una. */
const ROUTES: [string, LimitedTool][] = [
  ["/api/cv/generate", "cv"],
  ["/api/generate", "cv"],
  ["/api/carta", "carta"],
  ["/api/entrevista/preparar", "entrevista"],
  ["/api/video/guion", "video"],
];

export function toolForRoute(url: string): LimitedTool | null {
  const path = url.split("?")[0].replace(/\/+$/, "");
  return ROUTES.find(([route]) => path === route)?.[1] ?? null;
}

/** Funciones que sólo vienen con un plan pago (402 PLAN_FEATURE), con el texto que muestra el modal. */
export type PlanFeature = "keywords";
export const PLAN_FEATURE_EVENT = "maru:plan-feature";

/** Abre el modal de planes porque la función es del plan pago. Suma a la misma conversión que el límite (ver trackPlanFeatureViewed). */
export function notifyPlanFeature(feature: PlanFeature): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLAN_FEATURE_EVENT, { detail: { feature } }));
}

/** Llamarlo con la respuesta de error de una acción del usuario. Devuelve la herramienta si abrió el paywall. */
export function notifyPlanLimit(url: string, status: number, code: string | undefined): LimitedTool | null {
  if (typeof window === "undefined" || status !== 429 || code !== "PLAN_LIMIT") return null;
  const tool = toolForRoute(url);
  if (!tool) return null;
  window.dispatchEvent(new CustomEvent(PLAN_LIMIT_EVENT, { detail: { tool } }));
  return tool;
}
