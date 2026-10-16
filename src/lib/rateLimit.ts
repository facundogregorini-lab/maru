import { dbConfigured, takeCounter } from "./db";
/**
 * Freno de uso por IP para las rutas que llaman a la IA (cada pedido cuesta plata).
 * Usa Redis compartido cuando está configurado. La memoria local queda como alternativa sin base.
 */

export type Bucket = "pesado" | "liviano";

/** Pedidos por ventana de 10 minutos. Holgado aun con varias personas detrás de una misma IP (redes móviles, oficinas). */
export const LIMITS: Record<Bucket, number> = { pesado: 40, liviano: 200 };
export const WINDOW_MS = 10 * 60 * 1000;

const LIGHT = ["/api/entrevista/turno", "/api/carta/parrafo", "/api/bullet", "/api/autofill", "/api/video/feedback"];

export function bucketFor(path: string): Bucket {
  return LIGHT.some((p) => path.startsWith(p)) ? "liviano" : "pesado";
}

const hits = new Map<string, number[]>();

/** Registra un pedido y devuelve cuántos segundos esperar (0 si puede pasar). */
export function take(key: string, bucket: Bucket, now = Date.now()): number {
  const k = `${bucket}:${key}`;
  const recent = (hits.get(k) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMITS[bucket]) {
    hits.set(k, recent);
    return Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
  }
  recent.push(now);
  hits.set(k, recent);
  // Limpieza ocasional para que el mapa no crezca sin fin.
  if (hits.size > 5000) for (const [key2, ts] of hits) if (!ts.some((t) => now - t < WINDOW_MS)) hits.delete(key2);
  return 0;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "anon";
}

/** Para tests. */
export function resetRateLimit() {
  hits.clear();
}

/** Compartido entre instancias. La IP se guarda como SHA-256, con TTL y prefijo exclusivo de Maru. */
export async function takeShared(key: string, bucket: Bucket, now = Date.now()): Promise<number> {
  if (!dbConfigured()) return take(key, bucket, now);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return takeCounter(`maru:rate:${bucket}:${hash}`, LIMITS[bucket], WINDOW_MS, now);
}
