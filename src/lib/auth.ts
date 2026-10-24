import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Login con Google sin base de datos: al volver de Google se crea una sesión firmada (HMAC) en una cookie
 * httpOnly que dura 180 días ("recordarme"). El estado de OAuth también va firmado.
 */

export const SESSION_COOKIE = "maru_session";
export const SESSION_TTL_S = 180 * 24 * 60 * 60;

type TokenPayload = { typ: "session" | "oauth"; email: string; exp: number; n: string; next?: string; popup?: boolean };

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("Falta AUTH_SECRET (32+ caracteres) en las variables de entorno.");
  return "dev-only-secret-no-usar-en-produccion-0000";
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function sign(data: string): string {
  return b64url(createHmac("sha256", secret()).update(data).digest());
}

/** Firma corta de un valor (para links sin sesión, como la baja de las alertas). */
export function signValue(data: string): string {
  return sign(`valor:${data}`);
}
export function verifySignedValue(data: string, sig: string): boolean {
  const expected = Buffer.from(signValue(data));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function createToken(typ: TokenPayload["typ"], email: string, ttlSeconds: number, now = Date.now(), extra: Pick<TokenPayload, "next" | "popup"> = {}): string {
  const payload: TokenPayload = { typ, email, exp: Math.floor(now / 1000) + ttlSeconds, n: b64url(randomBytes(9)), ...extra };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

function readToken(token: string | undefined | null, typ: TokenPayload["typ"], now = Date.now()): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (payload.typ !== typ || typeof payload.email !== "string") return null;
    if (payload.exp * 1000 < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const createSessionToken = (email: string, now?: number) => createToken("session", email, SESSION_TTL_S, now);
export const verifySessionToken = (token: string | null | undefined, now?: number) => readToken(token, "session", now)?.email ?? null;

/** Estado firmado del ingreso con Google (vence en 10 minutos). `n` va también en una cookie: ata la vuelta a este navegador. */
export const OAUTH_COOKIE = "maru_oauth";
export const OAUTH_TTL_S = 10 * 60;
export const createOAuthState = (opts: { next: string; popup: boolean }, now?: number) => createToken("oauth", "", OAUTH_TTL_S, now, opts);
export function readOAuthState(token: string | null, now?: number): { n: string; next: string; popup: boolean } | null {
  const p = readToken(token, "oauth", now);
  return p ? { n: p.n, next: safeNext(p.next), popup: p.popup === true } : null;
}

export function readCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

/** Lee la cookie de sesión de un request. */
export function sessionEmail(req: Request): string | null {
  return verifySessionToken(readCookie(req, SESSION_COOKIE));
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_S): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function authRequired(): Response {
  return Response.json({ error: "Ingresá con tu email para descargar tu CV.", code: "AUTH_REQUIRED" }, { status: 401 });
}

/** Sólo rutas internas ("/cv", "/carta?x=1"): evita redirecciones abiertas a otros sitios. */
export function safeNext(raw: unknown): string {
  return typeof raw === "string" && /^\/(?![/\\])[^\s]*$/.test(raw) ? raw : "/";
}
