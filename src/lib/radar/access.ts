import { sessionEmail, verifySessionToken } from "@/lib/auth";
import { adminEmails } from "@/lib/match/admin";

/**
 * Feature flag del Radar laboral (servidor).
 * - `RADAR_ENABLED` sin definir o "0": apagado. Las rutas /radar responden 404 y no aparece en la navegación.
 * - `RADAR_ENABLED=admins`: sólo para los emails de `ADMIN_EMAILS` (probar en producción sin mostrarlo a nadie más).
 * - `RADAR_ENABLED=1`: para todos, o sólo para `RADAR_ALLOWLIST` (emails separados por coma) si está definida.
 */
export function radarMode(env: Record<string, string | undefined> = process.env): "off" | "admins" | "on" {
  const v = (env.RADAR_ENABLED ?? "").trim().toLowerCase();
  if (v === "admins") return "admins";
  if (v === "1" || v === "true" || v === "on") return "on";
  return "off";
}

function list(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function radarAllowed(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  const mode = radarMode(env);
  if (mode === "off") return false;
  const who = (email ?? "").trim().toLowerCase();
  if (mode === "admins") return !!who && adminEmails(env).has(who);
  const allow = list(env.RADAR_ALLOWLIST);
  return allow.size === 0 || (!!who && allow.has(who));
}

export const radarNotFound = () => Response.json({ error: "No encontrado.", code: "NOT_FOUND" }, { status: 404 });

/** Email de la sesión de un request, sin romper si falta AUTH_SECRET. */
export function requestEmail(req: Request): string | null {
  try {
    return sessionEmail(req);
  } catch {
    return null;
  }
}

export const radarAllowedFor = (req: Request) => radarAllowed(requestEmail(req));

/** Para páginas de servidor: el valor de la cookie de sesión. */
export function radarAllowedToken(token: string | undefined): boolean {
  let email: string | null = null;
  try {
    email = verifySessionToken(token);
  } catch {
    email = null;
  }
  return radarAllowed(email);
}
