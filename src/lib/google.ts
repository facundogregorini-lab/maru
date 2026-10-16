import { randomBytes } from "node:crypto";

/**
 * Ingreso con Google (OAuth 2.0, flujo con código) sin librerías.
 * Se configura con GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (Google Cloud → APIs y servicios → Credenciales,
 * "ID de cliente de OAuth" tipo aplicación web) y la URI de redireccionamiento `<sitio>/api/auth/google/callback`.
 */

export const OAUTH_COOKIE = "maru_oauth";
export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const redirectUri = (origin: string) => `${origin}/api/auth/google/callback`;

export function newState(): string {
  return randomBytes(18).toString("base64url");
}

export function authUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export type GoogleUser = { email: string; name: string; picture: string };

/**
 * Lee el id_token. Como llega directo del endpoint de tokens de Google por HTTPS (con nuestro secreto),
 * Google documenta que no hace falta validar la firma; sí validamos emisor, audiencia, vencimiento y email verificado.
 */
export function parseIdToken(idToken: string, now = Date.now()): GoogleUser | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString()) as Record<string, unknown>;
    const issOk = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
    if (!issOk || payload.aud !== process.env.GOOGLE_CLIENT_ID) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < now) return null;
    if (payload.email_verified !== true || typeof payload.email !== "string") return null;
    return { email: payload.email.toLowerCase(), name: String(payload.name ?? ""), picture: String(payload.picture ?? "") };
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string, origin: string, fetchImpl: typeof fetch = fetch): Promise<GoogleUser | null> {
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  return data.id_token ? parseIdToken(data.id_token) : null;
}
