/**
 * "Continuar con Google" (OAuth 2.0 / OpenID Connect, sin librerías).
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: credenciales de un "ID de cliente de OAuth" (aplicación web) en Google Cloud.
 * La URI de redirección autorizada es <origen>/api/auth/google/callback. Sin estas variables, el botón no aparece.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const googleRedirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function googleAuthUrl(origin: string, state: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/**
 * Cambia el código por el id_token y devuelve el email verificado.
 * El id_token llega directo de Google por TLS con nuestro secreto, así que alcanza con chequear aud, iss y vencimiento (OIDC 3.1.3.7).
 */
export async function googleEmail(origin: string, code: string, now = Date.now()): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) throw new Error(`Google no aceptó el código (${data.error ?? res.status}).`);
  const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString() || "{}") as {
    aud?: string; iss?: string; exp?: number; email?: string; email_verified?: boolean | string;
  };
  if (claims.aud !== process.env.GOOGLE_CLIENT_ID || !ISSUERS.includes(claims.iss ?? "") || (claims.exp ?? 0) * 1000 < now) {
    throw new Error("id_token de Google inválido.");
  }
  if (!claims.email || (claims.email_verified !== true && claims.email_verified !== "true")) throw new Error("La cuenta de Google no tiene un email verificado.");
  return claims.email;
}
