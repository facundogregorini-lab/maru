import { createHash, randomBytes } from "node:crypto";
import { createSessionToken, deriveSecret, normalizeEmail, readPayload, safeNext, sessionCookie, signPayload } from "./auth";

/**
 * "Continuar con Google" (OpenID Connect, flujo de código con PKCE) sin librerías ni base de datos.
 *
 * 1. /api/auth/google        → arma el `state` firmado (nonce + a dónde volver), guarda el nonce en una
 *                               cookie httpOnly y redirige a Google.
 * 2. /api/auth/google/callback → comprueba state + cookie, canjea el código en el servidor (con el secreto
 *                               y el code_verifier), valida el id_token y crea la MISMA sesión que el magic link.
 *
 * Variables: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (OAuth client "Web application" en Google Cloud).
 * Sólo pedimos `openid email`: Maru no lee nada más de la cuenta de Google.
 */

export const OAUTH_COOKIE = "maru_oauth";
const STATE_TTL_S = 10 * 60;
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export function googleConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET;
}

const b64url = (b: Buffer) => b.toString("base64url");
const challengeFor = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());
const verifierFor = (nonce: string) => deriveSecret("pkce", nonce);
export const callbackUrl = (origin: string) => `${origin}/api/auth/google/callback`;

function oauthCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OAUTH_COOKIE}=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readCookie(req: Request, name: string): string | null {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Paso 1: redirección a Google. */
export function startGoogleLogin(req: Request): Response {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const popup = url.searchParams.get("popup") === "1";
  if (!googleConfigured()) return finish(url.origin, next, popup, "google-no-configurado");

  const nonce = b64url(randomBytes(18));
  const state = signPayload("oauth-google", { nonce, next, popup }, STATE_TTL_S);
  const auth = new URL(AUTH_ENDPOINT);
  auth.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(url.origin),
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    code_challenge: challengeFor(verifierFor(nonce)),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return new Response(null, { status: 302, headers: { Location: auth.toString(), "Set-Cookie": oauthCookie(nonce, STATE_TTL_S), "Cache-Control": "no-store" } });
}

type IdClaims = { iss?: string; aud?: string | string[]; azp?: string; exp?: number; email?: string; email_verified?: boolean | string; nonce?: string };

function decodeIdToken(idToken: string): IdClaims | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString()) as IdClaims;
  } catch {
    return null;
  }
}

/**
 * Valida el id_token. Lo recibimos directo del token endpoint de Google por TLS y autenticados con el
 * client secret, así que (como permite OpenID Connect §3.1.3.7) no hace falta verificar la firma;
 * sí verificamos emisor, audiencia, vencimiento, nonce y email verificado.
 */
export function validateClaims(c: IdClaims | null, nonce: string, clientId: string, now = Date.now()): string | null {
  if (!c) return null;
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!c.iss || !ISSUERS.has(c.iss)) return null;
  if (!aud.includes(clientId)) return null;
  if (aud.length > 1 && c.azp !== clientId) return null;
  if (typeof c.exp !== "number" || c.exp * 1000 < now) return null;
  if (c.nonce !== nonce) return null;
  if (c.email_verified !== true && c.email_verified !== "true") return null;
  return normalizeEmail(c.email);
}

/** Paso 2: vuelta desde Google. */
export async function finishGoogleLogin(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const url = new URL(req.url);
  const state = readPayload<{ nonce: string; next: string; popup: boolean }>(url.searchParams.get("state"), "oauth-google");
  const next = safeNext(state?.next);
  const popup = !!state?.popup;
  const clear = oauthCookie("", 0);

  // Canceló en Google, state vencido/adulterado o la cookie no coincide (protege contra CSRF).
  const cookieNonce = readCookie(req, OAUTH_COOKIE);
  if (url.searchParams.get("error")) return finish(url.origin, next, popup, "google-cancelado", clear);
  if (!state || !cookieNonce || cookieNonce !== state.nonce || !googleConfigured()) return finish(url.origin, next, popup, "google-error", clear);
  const code = url.searchParams.get("code");
  if (!code) return finish(url.origin, next, popup, "google-error", clear);

  let email: string | null = null;
  try {
    const res = await fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl(url.origin),
        grant_type: "authorization_code",
        code_verifier: verifierFor(state.nonce),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = (await res.json()) as { id_token?: string };
      email = data.id_token ? validateClaims(decodeIdToken(data.id_token), state.nonce, process.env.GOOGLE_CLIENT_ID!) : null;
    } else {
      console.error("[auth] Google token endpoint respondió", res.status);
    }
  } catch (err) {
    console.error("[auth] no se pudo canjear el código de Google:", err instanceof Error ? err.message : "error");
  }
  if (!email) return finish(url.origin, next, popup, "google-error", clear);
  return finish(url.origin, next, popup, "ok", clear, sessionCookie(createSessionToken(email)));
}

/**
 * Cierra el flujo. En ventana emergente: una página mínima que avisa a la pestaña original y se cierra
 * (así no se pierde lo que la persona estaba armando). Si no, vuelve a la página de origen.
 */
function finish(origin: string, next: string, popup: boolean, result: string, ...cookies: string[]): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  if (popup) {
    headers.set("Content-Type", "text/html; charset=utf-8");
    const msg = JSON.stringify({ type: "maru:auth", result });
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maru</title></head>
<body style="font-family:system-ui,sans-serif;background:#fbf6ef;color:#2b2420;display:grid;place-items:center;min-height:100vh;margin:0">
<p>${result === "ok" ? "¡Listo! Ya podés volver a Maru." : "No pudimos completar el ingreso. Cerrá esta ventana y probá de nuevo."}</p>
<script>try{window.opener&&window.opener.postMessage(${msg},${JSON.stringify(origin)})}catch(e){}setTimeout(function(){window.close()},${result === "ok" ? 300 : 2500});</script>
</body></html>`;
    return new Response(html, { status: 200, headers });
  }
  const back = new URL(next, origin);
  back.searchParams.set("ingreso", result === "ok" ? "ok" : result);
  headers.set("Location", back.toString());
  return new Response(null, { status: 303, headers });
}
