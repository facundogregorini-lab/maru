import { loadInventory } from "./match/load";

/** Números y búsquedas reales del inventario de Maru para la home (nada inventado). */

export type LandingJob = { id: string; title: string; company: string; workplace: string; firstSeenAt: string };
export type LandingData = { total: number; companies: number; eligible: number; remote: number; latest: LandingJob[] };

const WORKPLACE: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" };

export async function landingData(): Promise<LandingData> {
  const { inv } = await loadInventory();
  const open = inv.opportunities.filter((o) => o.status === "abierta");
  const eligible = open.filter((o) => o.eligibility.status === "elegible");
  // Las más nuevas que se pueden tomar desde Argentina, una por empresa para que la cinta sea variada.
  const seen = new Set<string>();
  const latest: LandingJob[] = [];
  for (const o of [...eligible].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))) {
    if (seen.has(o.company) || o.title.length > 60) continue;
    seen.add(o.company);
    latest.push({ id: o.id, title: o.title, company: o.company, workplace: WORKPLACE[o.workplace?.value ?? ""] ?? "", firstSeenAt: o.firstSeenAt });
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
