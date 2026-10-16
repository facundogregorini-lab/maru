/**
 * Base de datos mínima: Upstash Redis por REST (se crea desde Vercel → Storage → Upstash, que carga
 * KV_REST_API_URL y KV_REST_API_TOKEN solas). Sin dependencias: son pedidos HTTP.
 *
 * Sin esas variables (desarrollo, tests o antes de configurarla) usa un Map en memoria: todo sigue
 * andando, pero nada persiste entre instancias. `dbEnabled()` dice si hay base de verdad; lo que
 * depende de ella (planes, límites del plan gratis, sincronización, alertas) se apaga sin base.
 */

type Cmd = (string | number)[];

const URL_ = () => process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const TOKEN = () => process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

export const dbEnabled = () => !!URL_() && !!TOKEN();

/* ---------- respaldo en memoria (mismo comportamiento que Redis para lo que usamos) ---------- */

const mem = new Map<string, { v: string | Set<string>; exp: number | null }>();

function live(key: string) {
  const e = mem.get(key);
  if (e && e.exp !== null && e.exp <= Date.now()) {
    mem.delete(key);
    return null;
  }
  return e ?? null;
}

function memExec(cmd: Cmd): unknown {
  const [op, key, ...args] = cmd.map(String);
  switch (op.toUpperCase()) {
    case "GET": {
      const e = live(key);
      return typeof e?.v === "string" ? e.v : null;
    }
    case "SET": {
      const ex = args.indexOf("EX");
      mem.set(key, { v: args[0], exp: ex >= 0 ? Date.now() + Number(args[ex + 1]) * 1000 : null });
      return "OK";
    }
    case "DEL":
      return mem.delete(key) ? 1 : 0;
    case "INCR": {
      const e = live(key);
      const n = (typeof e?.v === "string" ? Number(e.v) : 0) + 1;
      mem.set(key, { v: String(n), exp: e?.exp ?? null });
      return n;
    }
    case "EXPIRE": {
      const e = live(key);
      if (!e) return 0;
      e.exp = Date.now() + Number(args[0]) * 1000;
      return 1;
    }
    case "SADD": {
      const e = live(key);
      const s = e?.v instanceof Set ? e.v : new Set<string>();
      let added = 0;
      for (const a of args) {
        if (s.has(a)) continue;
        s.add(a);
        added++;
      }
      mem.set(key, { v: s, exp: e?.exp ?? null });
      return added;
    }
    case "SREM": {
      const e = live(key);
      if (!(e?.v instanceof Set)) return 0;
      let n = 0;
      for (const a of args) if (e.v.delete(a)) n++;
      return n;
    }
    case "SMEMBERS": {
      const e = live(key);
      return e?.v instanceof Set ? [...e.v] : [];
    }
    default:
      throw new Error(`Comando no soportado en memoria: ${op}`);
  }
}

/* ---------- ejecución ---------- */

export async function run<T = unknown>(cmd: Cmd): Promise<T> {
  if (!dbEnabled()) return memExec(cmd) as T;
  const res = await fetch(URL_(), {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(`[db] ${data.error ?? res.status}`);
  return data.result as T;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await run<string | null>(["GET", key]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  await run(ttlSeconds ? ["SET", key, JSON.stringify(value), "EX", ttlSeconds] : ["SET", key, JSON.stringify(value)]);
}

export const del = (key: string) => run(["DEL", key]);

/** Suma 1 y devuelve el total; la primera vez fija el vencimiento. */
export async function incr(key: string, ttlSeconds: number): Promise<number> {
  const n = await run<number>(["INCR", key]);
  if (n === 1) await run(["EXPIRE", key, ttlSeconds]);
  return n;
}

export const sadd = (key: string, ...members: string[]) => run<number>(["SADD", key, ...members]);
export const srem = (key: string, ...members: string[]) => run<number>(["SREM", key, ...members]);
export const smembers = (key: string) => run<string[]>(["SMEMBERS", key]);

/** Para tests. */
export function resetMemoryDb() {
  mem.clear();
}
