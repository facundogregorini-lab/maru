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

/** Dominios que aparecen en avisos pero no son de la empresa (bolsas, redes, correo). */
const NOT_COMPANY = /(greenhouse|lever|ashbyhq|teamtailor|linkedin|indeed|computrabajo|bumeran|zonajobs|glassdoor|google|facebook|instagram|twitter|youtube|bit|workable|bamboohr|smartrecruiters|catsone|gmail|hotmail|outlook|yahoo)$/;
const DOMAIN = /\b(?:www\.)?([a-z0-9-]+\.(?:com\.ar|com|io|ai|co|ar|net|org|tech|app|dev|global))\b/g;

/**
 * El sitio de la empresa según sus propios avisos: un dominio (sin subdominios) que aparece en el texto
 * y cuyo nombre coincide con el de la empresa ("Caylent" → caylent.com, "Santex" → santexgroup.com).
 * Sin coincidencia de nombre no adivinamos.
 */
export function companyDomains(postings: StoredPosting[]): Map<string, string> {
  const seen = new Map<string, Map<string, number>>();
  for (const p of postings) {
    if (isGenericCompany(p.company)) continue;
    const key = companyKey(p.company);
    for (const m of (p.descriptionText ?? "").toLowerCase().matchAll(DOMAIN)) {
      const d = m[1];
      if (NOT_COMPANY.test(d.split(".")[0])) continue;
      const v = seen.get(key) ?? new Map<string, number>();
      v.set(d, (v.get(d) ?? 0) + 1);
      seen.set(key, v);
    }
  }
  const out = new Map<string, string>();
  for (const [key, v] of seen) {
    const name = key.replace(/\b(labs?|technologies|technology|group|grupo|global)\b/g, "").replace(/[^a-z0-9]/g, "");
    if (name.length < 3) continue;
    const match = [...v]
      .filter(([d]) => {
        const base = d.split(".")[0].replace(/-/g, "");
        // El dominio es el nombre, o el nombre con un agregado corto ("halterhq", "santexgroup", "felixpago").
        return base === name || (base.startsWith(name) && name.length >= 4) || (name.startsWith(base) && base.length >= 6 && base.length / name.length >= 0.6);
      })
      .sort((a, b) => b[1] - a[1]);
    if (match.length) out.set(key, match[0][0]);
  }
  return out;
}

/** Ícono del sitio de la empresa (servicio público de Google, sin claves). */
export const domainLogo = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

/** Logos de la fuente, después los de la misma empresa y, si no hay, el ícono de su sitio. */
export function withCompanyLogos(postings: StoredPosting[]): StoredPosting[] {
  const shared = shareCompanyLogos(postings);
  const domains = companyDomains(shared);
  return shared.map((p) => {
    if (p.companyLogo || isGenericCompany(p.company)) return p;
    const d = domains.get(companyKey(p.company));
    return d ? { ...p, companyLogo: domainLogo(d) } : p;
  });
}
