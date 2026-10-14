import { createSessionToken, safeNext, sessionCookie, verifyLoginToken } from "@/lib/auth";

export const runtime = "nodejs";

/** El link del email apunta acá: valida el token, deja la sesión en una cookie y vuelve a la app. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = verifyLoginToken(url.searchParams.get("token"));
  const home = new URL(safeNext(url.searchParams.get("next")), url.origin);
  if (!email) {
    home.searchParams.set("ingreso", "vencido");
    return Response.redirect(home, 303);
  }
  home.searchParams.set("ingreso", "ok");
  return new Response(null, { status: 303, headers: { Location: home.toString(), "Set-Cookie": sessionCookie(createSessionToken(email)) } });
}
