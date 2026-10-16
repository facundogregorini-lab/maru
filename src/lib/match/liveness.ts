/**
 * Vigencia de avisos importados (feeds parciales: Fantastic, Google Jobs, Apify).
 * Como no se vuelven a descargar, de vez en cuando miramos la página original:
 * - 404/410 o un texto explícito de "aviso finalizado" → se cierra;
 * - cualquier otra respuesta (bloqueo, 429, 5xx, red) → no se toca (desconocido).
 * Pocos pedidos por corrida, en serie, con pausa y sin reintentos.
 */
import { safeFetch } from "./http";
import { buildOpportunities } from "./inventory";
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
  fetchImpl?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
  log?: (msg: string) => void;
};

export async function checkImportedLiveness(inv: Inventory, now: string, opts: LivenessOptions = {}) {
  const { max = 150, pauseMs = 700, minDaysBetween = 3, fetchImpl, resolve, log = () => {} } = opts;
  const cutoff = Date.parse(now) - minDaysBetween * 86_400_000;
  const due = inv.postings
    .filter((p) => p.status === "abierta" && sourceById(p.sourceId)?.imported && (!p.lastLiveCheckAt || Date.parse(p.lastLiveCheckAt) < cutoff))
    .sort((a, b) => (a.lastLiveCheckAt ?? "").localeCompare(b.lastLiveCheckAt ?? "") || a.firstSeenAt.localeCompare(b.firstSeenAt))
    .slice(0, max);
  const stats = { checked: 0, closed: 0, open: 0, unknown: 0 };
  for (const p of due) {
    let result: LiveStatus = { status: "desconocido" };
    try {
      result = await liveStatus(await safeFetch(p.sourceUrl, { fetchImpl, resolve, timeoutMs: 15_000 }));
    } catch {
      // Red, DNS o URL rechazada: no sabemos nada nuevo.
    }
    stats.checked++;
    p.lastLiveCheckAt = now;
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
  if (stats.closed) inv.opportunities = buildOpportunities(inv.postings);
  return stats;
}
