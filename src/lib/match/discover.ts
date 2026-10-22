import { importRejection } from "./import-filter";
import type { Directory } from "./directory";
import { sourceById } from "./sources";
import { fold } from "./text";
import type { StoredPosting } from "./types";

/**
 * Descubrimiento gratis de empleadores: de los avisos comprados (LinkedIn, Google Jobs, Fantastic) salen las
 * empresas que publican para la Argentina en las áreas que importamos. Si alguna tiene bolsa pública en
 * Greenhouse, Lever o Ashby, se suma al directorio y la sync diaria trae todos sus avisos, gratis y al día.
 */

/** Consultoras de selección, portales y bolsas de terceros: publican avisos de otros, no son el empleador. */
const AGENCY = /\b(recruit\w*|staffing|talent\w*|headhunt\w*|search|jobs?|empleos?|trabajos?|seleccion|consultor[ae]s?|outsourcing|rrhh|recursos humanos|hr solutions|manpower\w*|adecco|randstad|bumeran|zonajobs|computrabajo|universia|confidencial|importante empresa|empresa lider|workster|jobgether|crossover|turing|toptal|proxify|alignerr|outlier)\b/;
const LEGAL = /\b(s\.?a\.?u?|s\.?r\.?l|s\.?a\.?s|inc|llc|ltd|limited|corp(oration)?|gmbh|plc|co|company|group|grupo|holding|argentina|latam|latin america|international|global)\b\.?/gi;

export type DiscoveryCandidate = { company: string; postings: number };

export function isAgency(company: string): boolean {
  return AGENCY.test(fold(company));
}

/**
 * Empresas de los avisos importados abiertos, elegibles y de las áreas que importamos, que todavía no están
 * en el directorio, ordenadas por cantidad de avisos. Sólo las que tienen al menos `min`.
 */
export function discoveryCandidates(postings: StoredPosting[], dir: Directory, min = 2): DiscoveryCandidate[] {
  const known = new Set(dir.companies.map((c) => baseName(c.name)));
  const counts = new Map<string, DiscoveryCandidate>();
  for (const p of postings) {
    if (p.status !== "abierta" || !sourceById(p.sourceId)?.imported || p.eligibility.status !== "elegible") continue;
    if (importRejection(p.title, p.extracted.family.value) || isAgency(p.company)) continue;
    const key = baseName(p.company);
    if (!key || known.has(key)) continue;
    const c = counts.get(key) ?? { company: p.company, postings: 0 };
    c.postings++;
    counts.set(key, c);
  }
  return [...counts.values()].filter((c) => c.postings >= min).sort((a, b) => b.postings - a.postings || a.company.localeCompare(b.company));
}

/** Nombre sin forma jurídica ni sufijos geográficos, en minúsculas y sin acentos: «Kraken Inc.» → «kraken». */
export function baseName(company: string): string {
  return fold(company).replace(LEGAL, " ").replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Slugs posibles de la bolsa: el nombre junto y con guiones. La primera palabra sola sólo cuando es larga
 * y para Greenhouse, que informa el nombre de la empresa y se puede verificar (`nameMatches`).
 */
export function slugGuesses(company: string): { full: string[]; short: string | null } {
  const words = baseName(company).replace(/&/g, " and ").split(" ").filter(Boolean);
  if (!words.length) return { full: [], short: null };
  const full = [...new Set([words.join(""), words.join("-")])];
  const short = words.length > 1 && words[0].length >= 5 ? words[0] : null;
  return { full, short };
}

/** El nombre que informa la bolsa corresponde a la empresa del aviso (comparten la primera palabra). */
export function nameMatches(boardName: string, company: string): boolean {
  const a = baseName(boardName).split(" ")[0];
  const b = baseName(company).split(" ")[0];
  return !!a && a === b;
}
