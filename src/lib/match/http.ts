import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * HTTP para conectores: timeout, reintentos limitados con backoff exponencial y respeto de Retry-After.
 * También valida URLs ingresadas por personas (SSRF): sólo http(s), sin redes privadas, redirecciones revalidadas.
 */

export const USER_AGENT = "MaruJobsBot/1.0 (+https://github.com/facundogregorini-lab/maru)";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  /** Para tests: fetch y espera inyectables. */
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  maxRetryAfterMs?: number;
};

const defaultSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

/** GET con reintentos limitados (red, 429, 5xx) y respeto de Retry-After. */
async function fetchWithRetry(url: string, accept: string, opts: RetryOptions): Promise<Response> {
  const { retries = 3, timeoutMs = 20_000, fetchImpl = fetch, sleep = defaultSleep, maxRetryAfterMs = 120_000 } = opts;
  let attempt = 0;
  for (;;) {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (attempt >= retries) throw new HttpError(`Red: ${(err as Error).message}`, 0);
      await sleep(backoff(attempt++));
      continue;
    }
    if (res.ok) return res;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= retries) throw new HttpError(`HTTP ${res.status}`, res.status);
    const wait = retryAfterMs(res.headers.get("retry-after"));
    if (wait !== null && wait > maxRetryAfterMs) throw new HttpError(`HTTP ${res.status} (Retry-After demasiado largo)`, res.status);
    await sleep(wait ?? backoff(attempt));
    attempt++;
  }
}

export async function fetchJson<T>(url: string, opts: RetryOptions = {}): Promise<T> {
  return (await (await fetchWithRetry(url, "application/json", opts)).json()) as T;
}

/** Igual que fetchJson pero devuelve texto (feeds RSS/XML). */
export async function fetchText(url: string, opts: RetryOptions = {}): Promise<string> {
  return (await fetchWithRetry(url, "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5", opts)).text();
}

function backoff(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

/* ---------- SSRF ---------- */

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

type Resolver = (host: string) => Promise<string[]>;
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

/** Rechaza protocolos no http(s), credenciales en la URL, puertos raros y destinos privados. */
export async function assertPublicUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError("URL inválida", 400);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new HttpError("Protocolo no permitido", 400);
  if (u.username || u.password) throw new HttpError("La URL no puede incluir credenciales", 400);
  if (u.port && u.port !== "80" && u.port !== "443") throw new HttpError("Puerto no permitido", 400);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new HttpError("Destino no permitido", 400);
  }
  const addrs = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (!addrs.length) throw new HttpError("No se pudo resolver el dominio", 400);
  if (addrs.some(isPrivateAddress)) throw new HttpError("Destino no permitido", 400);
  return u;
}

/** GET de una URL pública siguiendo como máximo 3 redirecciones, validando cada salto. */
export async function safeFetch(raw: string, opts: { resolve?: Resolver; fetchImpl?: FetchLike; timeoutMs?: number } = {}): Promise<Response> {
  const { resolve = defaultResolver, fetchImpl = fetch, timeoutMs = 15_000 } = opts;
  let url = (await assertPublicUrl(raw, resolve)).toString();
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchImpl(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = (await assertPublicUrl(new URL(res.headers.get("location")!, url).toString(), resolve)).toString();
      continue;
    }
    return res;
  }
  throw new HttpError("Demasiadas redirecciones", 400);
}
