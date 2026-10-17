import { loadInventory } from "./match/load";
import { ageDays, HIDE_AFTER_DAYS } from "./match/ranking";
import { displayTitle, isInferred } from "./match/labels";

/** Números y búsquedas reales del inventario de Maru para la home (nada inventado). */

export type LandingJob = { id: string; title: string; company: string; workplace: string; firstSeenAt: string };
export type LandingData = { total: number; companies: number; eligible: number; remote: number; latest: LandingJob[] };

const WORKPLACE: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" };

export async function landingData(now = new Date()): Promise<LandingData> {
  const { inv, postings } = await loadInventory();
  const open = inv.opportunities.filter((o) => o.status === "abierta" && ageDays(o, now) <= HIDE_AFTER_DAYS && postings.get(o.primaryKey)?.applyUrl);
  const eligible = open.filter((o) => o.eligibility.status === "elegible");
  // Muestra reciente: distintas empresas, como máximo dos avisos por área.
  const seen = new Set<string>();
  const latest: LandingJob[] = [];
  const families = new Map<string, number>();
  for (const o of [...eligible].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))) {
    if (seen.has(o.company) || (families.get(o.extracted.family.value) ?? 0) >= 2) continue;
    families.set(o.extracted.family.value, (families.get(o.extracted.family.value) ?? 0) + 1);
    seen.add(o.company);
    latest.push({ id: o.id, title: displayTitle(o.title), company: o.company, workplace: (WORKPLACE[o.workplace?.value ?? ""] ?? "") + (isInferred(o.workplace) ? " (inferido)" : ""), firstSeenAt: o.firstSeenAt });
    if (latest.length === 16) break;
  }
  return {
    total: open.length,
    companies: new Set(open.map((o) => o.company)).size,
    eligible: eligible.length,
    remote: open.filter((o) => o.workplace?.value === "remoto").length,
    latest,
  };
}
