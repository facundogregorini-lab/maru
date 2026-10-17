/**
 * E0 — línea de base offline del inventario (docs/PLAN-AVISOS.md §3). Costo externo: cero.
 *
 *   npx --yes tsx@4 scripts/e0-baseline.ts [carpeta-de-salida]
 *
 * Lee el catálogo actual (data/match/inventory.json, agrupado igual que la web), corre el ranking
 * actual con los perfiles sintéticos de <carpeta>/perfiles.json y escribe baseline.json (métricas
 * del catálogo y de cada perfil) y resultados.json (top 20 por perfil, para revisar a mano).
 * Los chequeos automáticos son señales de apoyo, NO la etiqueta de verdad: la revisión manual va aparte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { opportunitiesOf } from "../src/lib/match/inventory";
import { loadInventory } from "../src/lib/match/load";
import { rankOpportunities, weightsFromEnv, type RankedItem } from "../src/lib/match/ranking";
import { SENIORITY_ORDER, type Inventory, type MatchPrefs, type MatchProfile, type RoleFamily, type Seniority } from "../src/lib/match/types";

type Perfil = { id: string; publico: string; area: RoleFamily; reserva: boolean; profile: MatchProfile; prefs: MatchPrefs };

const dir = path.resolve(process.argv[2] ?? "docs/research/e0-2026-10-16");
const { perfiles } = JSON.parse(readFileSync(path.join(dir, "perfiles.json"), "utf8")) as { perfiles: Perfil[] };

/** Familias que cuentan como "su área" para cada perfil (logística y operaciones van juntas en la práctica). */
const AREA_FAMILIES: Partial<Record<RoleFamily, RoleFamily[]>> = {
  logistica: ["logistica", "operaciones"],
  administracion: ["administracion", "finanzas"],
  finanzas: ["finanzas", "administracion"],
};
const familiesFor = (area: RoleFamily) => AREA_FAMILIES[area] ?? [area];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const countBy = <T>(xs: T[], key: (x: T) => string) => {
  const out: Record<string, number> = {};
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};

const ageBucket = (iso: string | null | undefined, now: number) => {
  if (!iso) return "sin_fecha";
  const days = (now - Date.parse(iso)) / 86_400_000;
  return days <= 7 ? "≤7d" : days <= 30 ? "8-30d" : days <= 90 ? "31-90d" : ">90d";
};

/** ¿Seniority compatible? Igual o a un escalón de lo pedido; desconocido = no se puede juzgar. */
function seniorityFit(item: Seniority | null, wanted: Seniority[]): "si" | "no" | "desconocido" {
  if (!item) return "desconocido";
  if (!wanted.length) return "si";
  const i = SENIORITY_ORDER.indexOf(item);
  return wanted.some((w) => Math.abs(SENIORITY_ORDER.indexOf(w) - i) <= 1) ? "si" : "no";
}

/** ¿Ubicación posible? Remoto (ya filtrado como elegible desde Argentina) o la ciudad/provincia del perfil. */
function locationFit(it: RankedItem, p: Perfil): "si" | "no" | "desconocido" {
  if (it.workplace === "remoto") return "si";
  const where = fold(it.locations.join(" "));
  if (!where) return "desconocido";
  const places = [p.prefs.ciudad, ...p.prefs.otrosLugares, ...p.profile.location.split(",")].map(fold).filter((x) => x && x !== "argentina");
  return places.some((pl) => where.includes(pl)) ? "si" : "no";
}

async function main() {
  const { inv, postings } = await loadInventory();
  const now = new Date();
  const t = now.getTime();

  // ---------- catálogo: registros, oportunidades canónicas y grupos visuales ----------
  const rawInv = JSON.parse(readFileSync(process.env.MATCH_INVENTORY_PATH ?? path.join("data", "match", "inventory.json"), "utf8")) as Inventory;
  const canonical = opportunitiesOf(rawInv);
  const openGroups = inv.opportunities.filter((o) => o.status === "abierta");
  const elig = openGroups.filter((o) => o.eligibility.status === "elegible");
  const pend = openGroups.filter((o) => o.eligibility.status === "por_confirmar");
  const usable = [...elig, ...pend];
  const catalog = {
    generatedAt: inv.generatedAt,
    niveles: {
      registros: rawInv.postings.length,
      registrosAbiertos: rawInv.postings.filter((p) => p.status === "abierta").length,
      oportunidadesCanonicasAbiertas: canonical.filter((o) => o.status === "abierta").length,
      gruposVisualesAbiertos: openGroups.length,
    },
    elegibilidad: countBy(openGroups, (o) => o.eligibility.status),
    empleadores: { abiertos: new Set(openGroups.map((o) => o.company)).size, elegibles: new Set(elig.map((o) => o.company)).size },
    fuentesRegistrosAbiertos: countBy(
      rawInv.postings.filter((p) => p.status === "abierta"),
      (p) => p.sourceId,
    ),
    familiaElegibles: countBy(elig, (o) => o.extracted.family.value),
    familiaPorConfirmar: countBy(pend, (o) => o.extracted.family.value),
    seniorityElegibles: countBy(elig, (o) => o.extracted.seniority?.value ?? "sin_dato"),
    modalidadElegibles: countBy(elig, (o) => o.workplace.value),
    antiguedadElegibles: countBy(elig, (o) => ageBucket(o.publishedAt ?? o.firstSeenAt, t)),
    elegiblesConUbicacionArgentina: elig.filter((o) => o.countries.includes("AR") || /argentina|buenos aires|cordoba|rosario|mendoza/i.test(fold(o.locations.join(" ")))).length,
  };

  // ---------- perfiles ----------
  const perPerfil = [];
  const resultados: Record<string, unknown> = {};
  for (const p of perfiles) {
    const out = rankOpportunities({
      opportunities: inv.opportunities,
      postings,
      profile: p.profile,
      prefs: p.prefs,
      interactions: { saved: [], discarded: [] },
      weights: weightsFromEnv(""),
      limit: 20,
      now,
    });
    const fams = familiesFor(p.area);
    const top = out.eligible;
    const top10 = top.slice(0, 10);
    const keys = top.map((i) => `${fold(i.title)}|${fold(i.company)}`);
    const supplyArea = elig.filter((o) => fams.includes(o.extracted.family.value));
    const supplyAreaSeniority = supplyArea.filter((o) => seniorityFit(o.extracted.seniority?.value ?? null, p.prefs.seniorities) !== "no");

    const rows = top.map((i, n) => ({
      pos: n + 1,
      id: i.id,
      title: i.title,
      company: i.company,
      score: i.score,
      confidence: i.confidence,
      family: i.family,
      seniority: i.seniority,
      workplace: i.workplace,
      locations: i.locations.slice(0, 3),
      eligibility: i.eligibility.status,
      publishedAt: i.publishedAt,
      descriptionComplete: i.descriptionComplete,
      url: i.sources[0]?.url ?? "",
      reasons: i.reasons,
      pending: i.pending,
      auto: { familiaDelArea: fams.includes(i.family), seniority: seniorityFit(i.seniority, p.prefs.seniorities), ubicacion: locationFit(i, p) },
    }));
    resultados[p.id] = { reserva: p.reserva, counts: out.counts, eligible: rows, pendingTop5: out.pending.slice(0, 5).map((i) => ({ id: i.id, title: i.title, company: i.company, family: i.family, score: i.score, pending: i.pending })) };

    perPerfil.push({
      id: p.id,
      publico: p.publico,
      area: p.area,
      reserva: p.reserva,
      ranking: out.counts,
      top20: {
        mostrados: top.length,
        empresasDistintas: new Set(top.map((i) => i.company)).size,
        duplicadosVisibles: keys.length - new Set(keys).size,
      },
      top10Automatico: {
        familiaDelArea: top10.filter((i) => fams.includes(i.family)).length,
        seniorityCompatible: top10.filter((i) => seniorityFit(i.seniority, p.prefs.seniorities) === "si").length,
        seniorityDesconocido: top10.filter((i) => !i.seniority).length,
        ubicacionPosible: top10.filter((i) => locationFit(i, p) === "si").length,
        descripcionCompleta: top10.filter((i) => i.descriptionComplete).length,
        scoreMedio: top10.length ? Math.round(top10.reduce((a, i) => a + i.score, 0) / top10.length) : null,
      },
      ofertaCatalogo: {
        familias: fams,
        elegiblesDelArea: supplyArea.length,
        elegiblesDelAreaConSeniorityPosible: supplyAreaSeniority.length,
        empleadoresDelArea: new Set(supplyArea.map((o) => o.company)).size,
      },
    });
  }

  const baseline = {
    etapa: "E0",
    fecha: now.toISOString(),
    commit: process.env.GIT_COMMIT ?? null,
    nota: "Ranking actual por reglas, sin cambios. Chequeos 'auto' = señales de apoyo, no etiqueta de verdad. Ver revision.json para la revisión manual.",
    catalogo: catalog,
    perfiles: perPerfil,
  };
  writeFileSync(path.join(dir, "baseline.json"), `${JSON.stringify(baseline, null, 2)}\n`);
  writeFileSync(path.join(dir, "resultados.json"), `${JSON.stringify(resultados, null, 2)}\n`);
  console.log(JSON.stringify({ catalogo: catalog.niveles, elegibilidad: catalog.elegibilidad }, null, 0));
  for (const r of perPerfil) console.log(r.id.padEnd(22), JSON.stringify({ elig: r.ranking.eligible, pend: r.ranking.pending, top10: r.top10Automatico, oferta: r.ofertaCatalogo.elegiblesDelArea }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
