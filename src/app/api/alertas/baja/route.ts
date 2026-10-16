import { removeAlert } from "@/lib/alerts";
import { verifyUnsubToken } from "@/lib/auth";

export const runtime = "nodejs";

/** "Dejar de recibir alertas" desde el email: sin ingresar, con un link firmado. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = verifyUnsubToken(url.searchParams.get("token"));
  if (email) await removeAlert(email, null);
  return Response.redirect(new URL(`/alertas/baja${email ? "" : "?error=1"}`, url.origin), 303);
}
