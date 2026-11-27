import { SESSION_COOKIE, verifySessionToken } from "../auth";
import { radarAllowedFor, radarFlagOn } from "./flag";

/** Para las páginas /radar/*: con el flag apagado ni lee la cookie (la ruta queda como un 404 normal). */
export async function radarPageAllowed(): Promise<boolean> {
  if (!radarFlagOn()) return false;
  let email: string | null = null;
  try {
    const { cookies } = await import("next/headers");
    email = verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  } catch {
    // sin AUTH_SECRET (Preview) o sin cookie: visita sin sesión
  }
  return radarAllowedFor(email);
}
