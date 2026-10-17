/**
 * Puente entre la respuesta del servidor y el modal de planes: cuando una acción choca con el cupo
 * gratis (429 PLAN_LIMIT de src/lib/billing/http.ts, la misma lógica que cobra el producto), avisamos
 * con un evento del navegador y el modal muestra los planes. No cuenta los frenos por exceso de uso
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

/** Llamarlo con la respuesta de error de una acción del usuario. Devuelve la herramienta si abrió el paywall. */
export function notifyPlanLimit(url: string, status: number, code: string | undefined): LimitedTool | null {
  if (typeof window === "undefined" || status !== 429 || code !== "PLAN_LIMIT") return null;
  const tool = toolForRoute(url);
  if (!tool) return null;
  window.dispatchEvent(new CustomEvent(PLAN_LIMIT_EVENT, { detail: { tool } }));
  return tool;
}
