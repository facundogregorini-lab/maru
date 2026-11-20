import type { Inventory } from "./types";

/**
 * Fuentes que casi nunca dejan ver el aviso al bot (p. ej. responden 403): no vale la pena gastar
 * pedidos en ellas, y sus avisos no se pueden confirmar publicados. Hace falta una muestra mínima
 * para no descartar una fuente por mala suerte. Puro (sin red): lo usan liveness.ts e inventory.ts.
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
