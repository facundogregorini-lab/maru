/**
 * Vigencia de avisos importados (feeds parciales: Fantastic, Google Jobs, Apify).
 * Como no se vuelven a descargar, de vez en cuando miramos la página original:
 * - 404/410 o un texto explícito de "aviso finalizado" → se cierra;
 * - cualquier otra respuesta (bloqueo, 429, 5xx, red) → no se toca (desconocido).
 * Pocos pedidos por corrida, en serie, con pausa y sin reintentos.
 */
import { safeFetch } from "./http";
import { sourceById } from "./sources";
import { fold } from "./text";
import type { Inventory } from "./types";

export type LiveStatus = { status: "abierta" | "cerrada" | "desconocido"; reason?: string };

/** Frases con las que los portales y ATS dicen que el aviso terminó (es/en/pt). Sólo frases explícitas. */
const CLOSED = [
  "no longer accepting applications",
  "this job is no longer available",
  "this job has expired",
  "this position has been filled",
  "this job posting has been closed",
  "the job you are looking for is no longer",
  "job not found",
  "position is no longer available",
  "esta oferta ya no esta disponible",
  "la oferta ya no esta disponible",
  "este aviso ya no esta disponible",
  "el aviso ya no esta disponible",
  "esta busqueda ha finalizado",
  "la busqueda ha finalizado",
  "aviso finalizado",
  "oferta finalizada",
  "esta oferta ha caducado",
  "la oferta ha expirado",
  "ya no acepta postulaciones",
  "ya no se aceptan postulaciones",
  "esta vaga nao esta mais disponivel",
];

const MAX_BYTES = 400_000;

async function readText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value);
    size += part.value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

export async function liveStatus(res: Response): Promise<LiveStatus> {
  if (res.status === 404 || res.status === 410) return { status: "cerrada", reason: `La página original respondió HTTP ${res.status}` };
  if (!res.ok) return { status: "desconocido" };
  const text = fold((await readText(res)).replace(/<[^>]+>/g, " "));
  const hit = CLOSED.find((p) => text.includes(p));
  return hit ? { status: "cerrada", reason: `La página original dice “${hit}”` } : { status: "abierta" };
}

export type LivenessOptions = {
  max?: number;
  pauseMs?: number;
  /** No volver a mirar un aviso antes de estos días. */
  minDaysBetween?: number;
  /** Tope de tiempo de la corrida: al pasarlo no se empieza otro pedido. */
  budgetMs?: number;
  clock?: () => number;
  fetchImpl?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
  log?: (msg: string) => void;
};

/**
 * Turna entre fuentes (una de cada una, en ronda) para que una fuente grande no se lleve todos
 * los pedidos del día. Dentro de cada fuente, primero lo que nunca se revisó o hace más que no.
 */
export function roundRobin<T extends { sourceId: string }>(items: T[], max: number): T[] {
  const queues = new Map<string, T[]>();
  for (const it of items) (queues.get(it.sourceId) ?? queues.set(it.sourceId, []).get(it.sourceId)!).push(it);
  const out: T[] = [];
  const lists = [...queues.values()];
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length && out.length < max) out.push(l[i]);
  }
  return out;
}

/**
 * Fuentes que casi nunca dejan ver el aviso al bot (p. ej. responden 403): no vale la pena gastar
 * pedidos en ellas. Hace falta una muestra mínima para no descartar una fuente por mala suerte.
 */
export function blockedSources(inv: Inventory, minChecks = 20, maxUnknownShare = 0.9): Set<string> {
  const tally = new Map<string, { n: number; unknown: number }>();
  for (const p of inv.postings) {
    if (!p.lastLiveResult) continue;
    const t = tally.get(p.sourceId) ?? { n: 0, unknown: 0 };
    t.n++;
    if (p.lastLiveResult === "desconocido") t.unknown++;
    tally.set(p.sourceId, t);
  }
  return new Set([...tally].filter(([, t]) => t.n >= minChecks && t.unknown / t.n >= maxUnknownShare).map(([id]) => id));
}

export async function checkImportedLiveness(inv: Inventory, now: string, opts: LivenessOptions = {}) {
  const { max = 150, pauseMs = 700, minDaysBetween = 3, budgetMs = Infinity, clock = Date.now, fetchImpl, resolve, log = () => {} } = opts;
  const start = clock();
  const cutoff = Date.parse(now) - minDaysBetween * 86_400_000;
  const blocked = blockedSources(inv);
  if (blocked.size) log(`Fuentes que bloquean la revisión (se saltean): ${[...blocked].join(", ")}`);
  const candidates = inv.postings
    .filter((p) => p.status === "abierta" && sourceById(p.sourceId)?.imported && !blocked.has(p.sourceId) && (!p.lastLiveCheckAt || Date.parse(p.lastLiveCheckAt) < cutoff))
    .sort((a, b) => (a.lastLiveCheckAt ?? "").localeCompare(b.lastLiveCheckAt ?? "") || a.firstSeenAt.localeCompare(b.firstSeenAt));
  const due = roundRobin(candidates, max);
  const stats = { checked: 0, closed: 0, open: 0, unknown: 0 };
  const bySource: Record<string, { abierta: number; cerrada: number; desconocido: number }> = {};
  for (const p of due) {
    if (clock() - start > budgetMs) {
      log(`Tope de tiempo alcanzado: quedan ${due.length - stats.checked} para la próxima corrida.`);
      break;
    }
    let result: LiveStatus = { status: "desconocido" };
    try {
      result = await liveStatus(await safeFetch(p.sourceUrl, { fetchImpl, resolve, timeoutMs: 15_000 }));
    } catch {
      // Red, DNS o URL rechazada: no sabemos nada nuevo.
    }
    stats.checked++;
    p.lastLiveCheckAt = now;
    p.lastLiveResult = result.status;
    const s = (bySource[p.sourceId] ??= { abierta: 0, cerrada: 0, desconocido: 0 });
    s[result.status]++;
    if (result.status === "cerrada") {
      p.status = "cerrada";
      p.closedReason = result.reason;
      p.closedAt = now;
      stats.closed++;
      log(`✗ ${p.key}: ${result.reason}`);
    } else if (result.status === "abierta") stats.open++;
    else stats.unknown++;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  for (const [id, s] of Object.entries(bySource)) log(`  ${id}: ${s.abierta} publicados, ${s.cerrada} cerrados, ${s.desconocido} sin dato`);
  return stats;
}
