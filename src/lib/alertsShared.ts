import type { Filters } from "./match/ranking";

/** Lo de las alertas que usa también el navegador (sin dependencias del servidor). */
export const MIN_ALERT_SCORE = 50;
export const MAX_ALERT_SCORE = 95;
export const DEFAULT_ALERT_SCORE = 70;

/** Lo que ve la persona de su alerta (sin el perfil, que ya tiene en el navegador). */
export type AlertView = { active: boolean; minScore: number; filters: Filters; lastSentAt: number | null };
