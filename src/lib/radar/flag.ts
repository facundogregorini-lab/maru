import { normalizeEmail } from "../auth";

/**
 * Feature flag de Radar laboral. Apagado (por defecto): no aparece en la navegación y /radar/* da 404.
 * RADAR_ENABLED=true lo prende; RADAR_ALLOWLIST (emails separados por coma) lo limita a esas cuentas.
 * No se configura en Production de Vercel (docs/radar/_REGLAS_COMUNES.md).
 */

export function radarFlagOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RADAR_ENABLED?.trim().toLowerCase() === "true";
}

export function radarAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.RADAR_ALLOWLIST ?? "")
    .split(",")
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => !!e);
}

/** true si la cuenta (o la visita sin sesión, si no hay allowlist) puede ver Radar. */
export function radarAllowedFor(email: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!radarFlagOn(env)) return false;
  const list = radarAllowlist(env);
  if (!list.length) return true;
  const e = normalizeEmail(email);
  return !!e && list.includes(e);
}

/** Hace falta leer la sesión para decidir (flag prendido con allowlist). */
export const radarNeedsSession = (env: NodeJS.ProcessEnv = process.env) => radarFlagOn(env) && radarAllowlist(env).length > 0;
