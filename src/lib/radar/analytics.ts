import { capture } from "../tracking/posthog";

/**
 * Eventos de Radar sobre la capa existente (PostHog en el navegador). Nunca CV, emails, notas ni descripciones:
 * sólo ids internos y categorías. Las propiedades pasan por una lista blanca.
 */

export type RadarEvent =
  | "radar_viewed"
  | "radar_company_followed"
  | "radar_priority_changed"
  | "radar_import_completed"
  | "radar_scan_completed"
  | "radar_opportunity_viewed"
  | "radar_opportunity_saved"
  | "radar_opportunity_dismissed"
  | "radar_recommendation_accepted"
  | "radar_settings_saved"
  | "radar_digest_delivered"
  | "radar_application_created";

const ALLOWED = new Set(["company_id", "job_id", "sector", "priority", "provider", "count", "coverage", "score_band", "screen", "status", "action"]);

export function scoreBand(score: number | null | undefined): string {
  if (score === null || score === undefined) return "sin_evaluar";
  return score >= 85 ? "85+" : score >= 70 ? "70-84" : score >= 50 ? "50-69" : "<50";
}

export function radarProps(props: Record<string, string | number | boolean | null | undefined>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = { source: "radar" };
  for (const [k, v] of Object.entries(props)) if (ALLOWED.has(k) && v !== null && v !== undefined) out[k] = typeof v === "string" ? v.slice(0, 80) : v;
  return out;
}

export function trackRadar(event: RadarEvent, props: Record<string, string | number | boolean | null | undefined> = {}): void {
  try {
    capture(event, radarProps(props));
  } catch {
    // sin analytics no pasa nada
  }
}
