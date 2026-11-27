import { sessionEmail } from "@/lib/auth";
import { radarAllowedFor, radarFlagOn } from "@/lib/radar/flag";
import { json, notFound } from "@/lib/radar/http";

/** Si esta visita ve Radar en la navegación. Con el flag apagado, 404. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!radarFlagOn()) return notFound();
  let email: string | null = null;
  try {
    email = sessionEmail(req);
  } catch {
    // sin AUTH_SECRET (Preview): se trata como visita sin sesión
  }
  return json({ visible: radarAllowedFor(email), signedIn: !!email });
}
