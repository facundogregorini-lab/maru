import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateAddress } from "../../match/http";

/**
 * Cliente HTTP de Radar, compartido por todos los adaptadores.
 * - Sólo https, sin credenciales en la URL ni puertos raros.
 * - SSRF: resuelve el dominio y rechaza localhost, redes privadas, link-local y metadata; revalida cada redirect.
 * - Timeout, tope de bytes leídos y User-Agent identificable.
 * - Reintentos con backoff exponencial y jitter en red caída, 429 y 5xx (respeta Retry-After con tope).
 * El contenido que devuelve es no confiable: lo valida cada adaptador (Zod) y nunca va a un modelo como instrucción.
 */

export const RADAR_USER_AGENT = "MaruRadarBot/1.0 (+https://github.com/facundogregorini-lab/maru)";

export type NetErrorKind = "blocked" | "timeout" | "network" | "rate_limited" | "http" | "too_large" | "invalid";

export class NetError extends Error {
  constructor(message: string, public kind: NetErrorKind, public status = 0) {
    super(message);
  }
}

export type Resolver = (host: string) => Promise<string[]>;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type NetOptions = {
  resolve?: Resolver;
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
  maxBytes?: number;
  retries?: number;
  maxRetryAfterMs?: number;
  accept?: string;
  /** Cuenta cada intento (para monitoring_run_items). */
  onAttempt?: () => void;
};

const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address);
const METADATA_HOSTS = new Set(["metadata.google.internal", "metadata", "instance-data", "169.254.169.254", "fd00:ec2::254"]);

/** Valida que la URL sea https pública. Lanza NetError("blocked") si no. */
export async function assertSafeUrl(raw: string, resolve: Resolver = defaultResolver): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new NetError("URL inválida", "blocked");
  }
  if (u.protocol !== "https:") throw new NetError("Sólo se permiten links https", "blocked");
  if (u.username || u.password) throw new NetError("La URL no puede tener credenciales", "blocked");
  if (u.port && u.port !== "443") throw new NetError("Puerto no permitido", "blocked");
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local") || METADATA_HOSTS.has(host)) {
    throw new NetError("Destino no permitido", "blocked");
  }
  let addrs: string[];
  if (isIP(host)) addrs = [host];
  else {
    try {
      addrs = await resolve(host);
    } catch {
      addrs = [];
    }
  }
  if (!addrs.length) throw new NetError("No se pudo resolver el dominio", "network");
  if (addrs.some((a) => isPrivateAddress(a) || METADATA_HOSTS.has(a))) throw new NetError("Destino no permitido", "blocked");
  return u;
}

export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

/** Espera de reintento: exponencial con jitter completo (0..base), con tope. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(20_000, 800 * 2 ** attempt);
  return Math.round(base / 2 + random() * (base / 2));
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new NetError("Respuesta demasiado grande", "too_large", res.status);
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new NetError("Respuesta demasiado grande", "too_large", res.status);
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(buf);
}

export type NetResponse = { status: number; url: string; text: string; contentType: string };

/**
 * GET seguro. Sigue hasta 4 redirecciones validando cada una. 404/410 y otros 4xx no se reintentan
 * (devuelven NetError "http" con su status); 429 y 5xx sí, con backoff.
 */
export async function safeGet(raw: string, opts: NetOptions = {}): Promise<NetResponse> {
  const {
    resolve = defaultResolver,
    fetchImpl = fetch as FetchLike,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
    timeoutMs = 15_000,
    maxBytes = 5 * 1024 * 1024,
    retries = 2,
    maxRetryAfterMs = 30_000,
    accept = "application/json",
    onAttempt,
  } = opts;
  let attempt = 0;
  for (;;) {
    let url = (await assertSafeUrl(raw, resolve)).toString();
    let res: Response | null = null;
    try {
      onAttempt?.();
      for (let hop = 0; ; hop++) {
        res = await fetchImpl(url, { redirect: "manual", headers: { "User-Agent": RADAR_USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(timeoutMs) });
        const loc = res.headers.get("location");
        if (res.status >= 300 && res.status < 400 && loc) {
          if (hop >= 4) throw new NetError("Demasiadas redirecciones", "invalid", res.status);
          url = (await assertSafeUrl(new URL(loc, url).toString(), resolve)).toString();
          continue;
        }
        break;
      }
    } catch (err) {
      if (err instanceof NetError) throw err;
      const name = (err as Error)?.name;
      const kind: NetErrorKind = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
      if (attempt >= retries) throw new NetError(kind === "timeout" ? "Tiempo de espera agotado" : "Error de red", kind);
      await sleep(backoffMs(attempt++, random));
      continue;
    }
    const r = res!;
    if (r.ok) return { status: r.status, url, text: await readCapped(r, maxBytes), contentType: r.headers.get("content-type") ?? "" };
    const retriable = r.status === 429 || r.status >= 500;
    if (!retriable || attempt >= retries) throw new NetError(`HTTP ${r.status}`, r.status === 429 ? "rate_limited" : "http", r.status);
    const wait = retryAfterMs(r.headers.get("retry-after"));
    if (wait !== null && wait > maxRetryAfterMs) throw new NetError(`HTTP ${r.status} (pide esperar demasiado)`, r.status === 429 ? "rate_limited" : "http", r.status);
    await sleep(wait ?? backoffMs(attempt, random));
    attempt++;
  }
}

/** GET + JSON.parse. La validación de forma la hace quien llama, con Zod. */
export async function safeGetJson(raw: string, opts: NetOptions = {}): Promise<unknown> {
  const res = await safeGet(raw, { accept: "application/json", ...opts });
  try {
    return JSON.parse(res.text);
  } catch {
    throw new NetError("La respuesta no es JSON", "invalid", res.status);
  }
}

/** Mensaje de error apto para guardar y mostrar: sin URLs, sin datos, corto. */
export function sanitizeError(err: unknown): string {
  if (err instanceof NetError) return err.message.slice(0, 120);
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/https?:\/\/\S+/g, "[url]").replace(/[\r\n]+/g, " ").slice(0, 120) || "Error";
}
