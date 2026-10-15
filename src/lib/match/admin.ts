import { sessionEmail } from "../auth";

/**
 * Administración del match: sólo emails listados en ADMIN_EMAILS (separados por coma) y con sesión iniciada.
 * Sin ADMIN_EMAILS configurado, nadie es administrador.
 */
export function adminEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function isAdmin(req: Request): boolean {
  let email: string | null = null;
  try {
    email = sessionEmail(req);
  } catch {
    return false;
  }
  return !!email && adminEmails().has(email);
}

export function adminDenied(req: Request): Response | null {
  if (isAdmin(req)) return null;
  let logged = false;
  try {
    logged = !!sessionEmail(req);
  } catch {
    // sin AUTH_SECRET en producción: tratamos como no autenticado
  }
  return logged
    ? Response.json({ error: "No tenés permisos de administración.", code: "FORBIDDEN" }, { status: 403 })
    : Response.json({ error: "Ingresá con tu email de administración.", code: "AUTH_REQUIRED" }, { status: 401 });
}
