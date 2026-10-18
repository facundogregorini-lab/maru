import { loadInventory } from "./match/load";
import { ageDays, HIDE_AFTER_DAYS } from "./match/ranking";
import { displayTitle, isInferred } from "./match/labels";

/** Números y búsquedas reales del inventario de Maru para la home (nada inventado). */

export type LandingJob = { id: string; title: string; company: string; workplace: string; firstSeenAt: string; logo?: string };
export type LandingData = {
  total: number;
  companies: number;
  eligible: number;
  remote: number;
  /** Lo mismo, contado sólo sobre los avisos que se pueden pedir desde Argentina. */
  eligibleCompanies: number;
  eligibleRemote: number;
  /** Áreas con al menos un aviso elegible, sin contar "otros". */
  areas: number;
  latest: LandingJob[];
};

/** Cifra redondeada hacia abajo para la home ("4.100+"): sigue siendo cierta aunque el catálogo cambie cada hora. */
export function atLeast(n: number): string {
  if (n < 100) return n.toLocaleString("es-AR");
  return `${(Math.floor(n / 100) * 100).toLocaleString("es-AR")}+`;
}

const WORKPLACE: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" };

export async function landingData(now = new Date()): Promise<LandingData> {
  const { inv, postings } = await loadInventory();
  const open = inv.opportunities.filter((o) => o.status === "abierta" && ageDays(o, now) <= HIDE_AFTER_DAYS && postings.get(o.primaryKey)?.applyUrl);
  const eligible = open.filter((o) => o.eligibility.status === "elegible");
  // Muestra reciente: distintas empresas, como máximo dos avisos por área. Primero las que tienen logo
  // (la cinta de la home se ve como la de jobright); si no alcanzan, se completa con las demás.
  const logoOf = (o: (typeof eligible)[number]) => o.postingKeys.map((k) => postings.get(k)?.companyLogo).find(Boolean);
  const seen = new Set<string>();
  const latest: LandingJob[] = [];
  const families = new Map<string, number>();
  const recent = [...eligible].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  for (const withLogo of [true, false]) {
    for (const o of recent) {
      if (latest.length === 16) break;
      const logo = logoOf(o);
      if (Boolean(logo) !== withLogo || seen.has(o.company) || (families.get(o.extracted.family.value) ?? 0) >= 2) continue;
      families.set(o.extracted.family.value, (families.get(o.extracted.family.value) ?? 0) + 1);
      seen.add(o.company);
      latest.push({ id: o.id, title: displayTitle(o.title), company: o.company, workplace: (WORKPLACE[o.workplace?.value ?? ""] ?? "") + (isInferred(o.workplace) ? " (inferido)" : ""), firstSeenAt: o.firstSeenAt, ...(logo ? { logo } : {}) });
    }
  }
  latest.sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  return {
    total: open.length,
    companies: new Set(open.map((o) => o.company)).size,
    eligible: eligible.length,
    remote: open.filter((o) => o.workplace?.value === "remoto").length,
    eligibleCompanies: new Set(eligible.map((o) => o.company)).size,
    eligibleRemote: eligible.filter((o) => o.workplace?.value === "remoto").length,
    areas: new Set(eligible.map((o) => o.extracted.family.value).filter((f) => f !== "otros")).size,
    latest,
  };
}
