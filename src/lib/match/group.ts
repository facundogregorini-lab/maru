import type { Opportunity } from "./types";

/**
 * Muchas empresas publican el mismo puesto una vez por ciudad o país (hasta cientos de veces).
 * Para la persona es una sola búsqueda: las agrupamos por puesto + empresa y juntamos las ubicaciones.
 * Los ids de las copias quedan como alias del representante, así los links viejos siguen andando.
 */

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Sufijos que distintas fuentes agregan o sacan al nombre ("NEO-BIZ Consultores" y "Neo-Biz" son la misma). */
const COMPANY_SUFFIX = new Set(["s", "a", "sa", "srl", "sas", "sau", "saic", "inc", "llc", "ltd", "ltda", "corp", "co", "consultores", "consultora", "consulting", "argentina", "group", "grupo"]);

export function companyKey(name: string): string {
  const toks = fold(name).split(" ");
  while (toks.length > 1 && COMPANY_SUFFIX.has(toks[toks.length - 1])) toks.pop();
  return toks.join(" ");
}

const ELIG_RANK ={ elegible: 0, por_confirmar: 1, no_elegible: 2 } as const;
const date = (o: Opportunity) => o.publishedAt ?? o.firstSeenAt;

/** Mejor representante: abierta, que se pueda tomar desde Argentina y la más nueva. */
function better(a: Opportunity, b: Opportunity): Opportunity {
  if (a.status !== b.status) return a.status === "abierta" ? a : b;
  const ea = ELIG_RANK[a.eligibility.status] ?? 3;
  const eb = ELIG_RANK[b.eligibility.status] ?? 3;
  if (ea !== eb) return ea < eb ? a : b;
  return date(a) >= date(b) ? a : b;
}

const union = (lists: string[][]) => [...new Set(lists.flat())];

export function groupOpportunities(opps: Opportunity[]): { opportunities: Opportunity[]; alias: Map<string, string> } {
  const groups = new Map<string, Opportunity[]>();
  for (const o of opps) {
    const key = `${fold(o.title)}|${companyKey(o.company)}`;
    const g = groups.get(key);
    if (g) g.push(o);
    else groups.set(key, [o]);
  }
  const alias = new Map<string, string>();
  const out: Opportunity[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) {
      out.push(g[0]);
      continue;
    }
    const rep = g.reduce(better);
    // Sólo se juntan las que comparten estado con el representante (una cerrada no suma ubicaciones a una abierta).
    const same = g.filter((o) => o.status === rep.status);
    const others = same.filter((o) => o !== rep);
    for (const o of others) alias.set(o.id, rep.id);
    out.push({
      ...rep,
      locations: union([rep.locations, ...others.map((o) => o.locations)]),
      countries: union([rep.countries, ...others.map((o) => o.countries)]),
      postingKeys: union([rep.postingKeys, ...others.map((o) => o.postingKeys)]),
    });
    // Las de otro estado (p. ej. cerradas) quedan aparte, como estaban.
    out.push(...g.filter((o) => o.status !== rep.status));
  }
  return { opportunities: out, alias };
}
