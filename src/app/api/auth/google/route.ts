import { OAUTH_COOKIE, OAUTH_TTL_S, createOAuthState, readOAuthState, safeNext } from "@/lib/auth";
import { googleAuthUrl, googleEnabled } from "@/lib/google";

export const runtime = "nodejs";

/** El botón "Continuar con Google" abre esto (en una ventana aparte, ?popup=1): manda a Google con un estado firmado. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  if (!googleEnabled()) {
    const back = new URL(next, url.origin);
    back.searchParams.set("ingreso", "google-error");
    return Response.redirect(back, 303);
  }
  const state = createOAuthState({ next, popup: url.searchParams.get("popup") === "1" });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: googleAuthUrl(url.origin, state),
      "Set-Cookie": `${OAUTH_COOKIE}=${readOAuthState(state)!.n}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_TTL_S}${secure}`,
    },
  });
}
