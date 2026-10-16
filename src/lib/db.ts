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
async function pipeline(cmds: Cmd[]): Promise<unknown[]> {
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

/** Para tests. */
export function resetMemoryDb() {
  memory.clear();
}
