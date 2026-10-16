import { safeNext } from "@/lib/auth";
import { OAUTH_COOKIE, authUrl, googleEnabled, newState } from "@/lib/google";

export const runtime = "nodejs";

/** "Continuar con Google": guarda un estado anti-falsificación y manda a la pantalla de Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  if (!googleEnabled()) {
    const home = new URL(next, url.origin);
    home.searchParams.set("ingreso", "google-no");
    return Response.redirect(home, 303);
  }
  const state = newState();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 303,
    headers: {
      Location: authUrl(url.origin, state),
      "Set-Cookie": `${OAUTH_COOKIE}=${encodeURIComponent(`${state}|${next}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
    },
  });
}
