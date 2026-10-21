/**
 * Base de datos de Maru: un Redis de Upstash por su API REST (sin dependencias, anda en cualquier runtime).
 * En Vercel se crea desde Storage → Upstash for Redis, que agrega solas las variables KV_REST_API_URL y
 * KV_REST_API_TOKEN (también sirven UPSTASH_REDIS_REST_URL / _TOKEN).
 * Sin esas variables, fuera de producción usa un mapa en memoria (desarrollo y tests); en producción
 * la base queda "no configurada" y Maru sigue andando sólo con el navegador.
 *
 * La base se comparte con otras apps: todas las claves de Maru empiezan con "maru:".
 */

type Conn = { url: string; token: string };

const URL_VARS = ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"];
const TOKEN_VARS = ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"];

function fromEnv(names: string[]): string | undefined {
  for (const n of names) if (process.env[n]) return process.env[n];
  // Vercel a veces les agrega un prefijo (p. ej. STORAGE_KV_REST_API_URL).
  for (const [k, v] of Object.entries(process.env)) if (v && names.some((n) => k.endsWith(`_${n}`))) return v;
  return undefined;
}

function conn(): Conn | null {
  const url = fromEnv(URL_VARS);
  const token = fromEnv(TOKEN_VARS);
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

const memory = new Map<string, string>();
const lists = new Map<string, string[]>();
const inMemory = () => !conn() && process.env.NODE_ENV !== "production";

/** true si hay dónde guardar (Upstash, o la memoria en desarrollo). */
export function dbConfigured(): boolean {
  return !!conn() || inMemory();
}

export class DbError extends Error {
  code = "DB_UNAVAILABLE";
}

type Cmd = (string | number)[];

/** Corre varios comandos en un solo viaje. Devuelve el resultado de cada uno. */
export async function pipeline(cmds: Cmd[]): Promise<unknown[]> {
  if (inMemory()) return cmds.map(runMemory);
  const c = conn();
  if (!c) throw new DbError("La base de datos no está configurada.");
  let res: Response;
  try {
    res = await fetch(`${c.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds.map((cmd) => cmd.map(String))),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new DbError(`No pudimos conectar con la base de datos: ${err instanceof Error ? err.message : err}`);
  }
  if (!res.ok) throw new DbError(`La base de datos respondió ${res.status}.`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  const failed = out.find((r) => r.error);
  if (failed) throw new DbError(`Error de la base de datos: ${failed.error}`);
  return out.map((r) => r.result ?? null);
}

function runMemory([op, key, ...args]: Cmd): unknown {
  const k = String(key);
  switch (String(op).toUpperCase()) {
    case "GET":
      return memory.get(k) ?? null;
    case "SET":
      memory.set(k, String(args[0]));
      return "OK";
    case "MGET":
      return [k, ...args.map(String)].map((x) => memory.get(x) ?? null);
    case "EXISTS":
      return memory.has(k) ? 1 : 0;
    case "LPUSH": {
      const list = lists.get(k) ?? [];
      list.unshift(...args.map(String).reverse());
      lists.set(k, list);
      return list.length;
    }
    case "LTRIM":
      lists.set(k, (lists.get(k) ?? []).slice(Number(args[0]), Number(args[1]) + 1));
      return "OK";
    case "LRANGE":
      return (lists.get(k) ?? []).slice(Number(args[0]), Number(args[1]) + 1);
    default:
      throw new DbError(`Comando no soportado en memoria: ${op}`);
  }
}

export async function getManyJson<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return [];
  const [raw] = await pipeline([["MGET", ...keys]]);
  return (raw as (string | null)[]).map((r) => (typeof r === "string" ? (JSON.parse(r) as T) : null));
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await pipeline([["SET", key, JSON.stringify(value)]]);
}

/**
 * Guarda la clave sólo si no existe (SET NX), con vencimiento opcional. true = la guardó esta llamada.
 * Sirve para marcar hitos una única vez aunque lleguen pedidos repetidos o concurrentes.
 */
const memoryExpiry = new Map<string, number>();
export async function setIfAbsent(key: string, value: unknown, ttlMs?: number, now = Date.now()): Promise<boolean> {
  if (inMemory()) {
    const expires = memoryExpiry.get(key);
    if (expires !== undefined && expires <= now) { memory.delete(key); memoryExpiry.delete(key); }
    if (memory.has(key)) return false;
    memory.set(key, JSON.stringify(value));
    if (ttlMs) memoryExpiry.set(key, now + ttlMs);
    return true;
  }
  const cmd: Cmd = ["SET", key, JSON.stringify(value), "NX"];
  if (ttlMs) cmd.push("PX", Math.max(1, Math.round(ttlMs)));
  const [result] = await pipeline([cmd]);
  return result === "OK";
}

/** true si la clave existe (sin modificarla). */
export async function keyExists(key: string, now = Date.now()): Promise<boolean> {
  if (inMemory()) {
    const expires = memoryExpiry.get(key);
    if (expires !== undefined && expires <= now) { memory.delete(key); memoryExpiry.delete(key); }
    return memory.has(key);
  }
  const [result] = await pipeline([["EXISTS", key]]);
  return Number(result) > 0;
}

/** Agrega al comienzo de una lista y conserva sólo las últimas `max` entradas (registro de diagnóstico). */
export async function pushRecent(key: string, value: unknown, max: number): Promise<void> {
  await pipeline([["LPUSH", key, JSON.stringify(value)], ["LTRIM", key, 0, max - 1]]);
}

export async function readRecent<T>(key: string, max: number): Promise<T[]> {
  const [raw] = await pipeline([["LRANGE", key, 0, max - 1]]);
  return (raw as string[]).map((r) => JSON.parse(r) as T);
}

/** Para tests. */
export function resetMemoryDb() {
  lists.clear();
  memoryExpiry.clear();
  memory.clear();
}

/** Compare-and-set atómico: una versión vieja nunca pisa cambios de otro dispositivo. */
export async function compareAndSetJson<T extends { updatedAt: number }>(key: string, expected: number, value: T): Promise<{ ok: boolean; current: T | null }> {
  if (inMemory()) {
    const current = JSON.parse(memory.get(key) ?? "null") as T | null;
    if ((current?.updatedAt ?? 0) !== expected) return { ok: false, current };
    memory.set(key, JSON.stringify(value));
    return { ok: true, current: value };
  }
  const script = `local raw = redis.call('GET', KEYS[1])
local version = 0
if raw then version = cjson.decode(raw).updatedAt end
if version ~= tonumber(ARGV[1]) then return {0, raw or ''} end
redis.call('SET', KEYS[1], ARGV[2])
return {1, ARGV[2]}`;
  const [result] = await pipeline([["EVAL", script, 1, key, expected, JSON.stringify(value)]]);
  const [ok, raw] = result as [number, string];
  return { ok: ok === 1, current: raw ? JSON.parse(raw) as T : null };
}

/** Contador con vencimiento, incrementado y limitado en una única operación de Redis. */
const counters = new Map<string, { count: number; expires: number }>();
export async function takeCounter(key: string, limit: number, windowMs: number, now = Date.now()): Promise<number> {
  if (inMemory()) {
    let counter = counters.get(key);
    if (!counter || counter.expires <= now) counters.set(key, counter = { count: 0, expires: now + windowMs });
    if (counter.count >= limit) return Math.max(1, Math.ceil((counter.expires - now) / 1000));
    counter.count++;
    if (counters.size > 5000) for (const [k, c] of counters) if (c.expires <= now) counters.delete(k);
    return 0;
  }
  const script = `local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[1]) then return math.max(1, math.ceil(redis.call('PTTL', KEYS[1]) / 1000)) end
local next = redis.call('INCR', KEYS[1])
if next == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return 0`;
  const [wait] = await pipeline([["EVAL", script, 1, key, limit, windowMs]]);
  return Number(wait);
}
export function resetMemoryCounters() { counters.clear(); }
