import { isGenericCompany } from "./labels";
import { fold } from "./text";
import type { StoredPosting } from "./types";

/**
 * Logos compartidos por empresa: si una fuente trae el logo de "Randstad Argentina", los avisos de
 * "Randstad" que llegaron sin logo (ATS, Computrabajo, LinkedIn) lo muestran también. Costo cero.
 * Nunca para empresas confidenciales ni nombres genéricos, y sin tocar el inventario guardado.
 */
export function companyKey(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\b(s ?a ?s|s ?r ?l|s ?a|s ?a ?u|inc|llc|ltd|ltda|corp|co|sociedad anonima)\b/g, " ")
    .replace(/\s+argentina\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function shareCompanyLogos(postings: StoredPosting[]): StoredPosting[] {
  const votes = new Map<string, Map<string, number>>();
  for (const p of postings) {
    if (!p.companyLogo?.startsWith("https://") || isGenericCompany(p.company)) continue;
    const key = companyKey(p.company);
    if (!key) continue;
    const v = votes.get(key) ?? new Map<string, number>();
    v.set(p.companyLogo, (v.get(p.companyLogo) ?? 0) + 1);
    votes.set(key, v);
  }
  // Si una empresa tiene varios logos, el más usado.
  const best = new Map([...votes].map(([k, v]) => [k, [...v].sort((a, b) => b[1] - a[1])[0][0]]));
  return postings.map((p) => {
    if (p.companyLogo || isGenericCompany(p.company)) return p;
    const logo = best.get(companyKey(p.company));
    return logo ? { ...p, companyLogo: logo } : p;
  });
}
