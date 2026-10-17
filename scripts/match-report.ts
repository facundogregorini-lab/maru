/**
 * Reporte de proveedores: gasto, avisos por fuente, verticales y duplicación. Costo externo: cero.
 *
 *   npx --yes tsx@4 scripts/match-report.ts [--apify-real-usd=4.56] [--out=archivo.json]
 *
 * - Gasto: Fantastic (trial) y SerpApi (plan gratuito) no cobran. Apify registra en el ledger un
 *   estimado conservador por corrida; si se pasa el gasto real de la cuenta (`mode=status`), se
 *   reparte entre Actors en proporción al estimado.
 * - Duplicación: una publicación está duplicada si su oportunidad canónica (inventory.ts,
 *   groupPostings) también tiene una publicación de otra fuente. "Ya la teníamos gratis" = esa otra
 *   publicación es de un ATS o portal gratuito.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { groupOpportunities } from "../src/lib/match/group";
import { opportunitiesOf } from "../src/lib/match/inventory";
import type { Inventory, RoleFamily, StoredPosting } from "../src/lib/match/types";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const apifyRealUsd = arg("apify-real-usd") ? Number(arg("apify-real-usd")) : null;

const DATA = path.resolve("data/match");
const inv = JSON.parse(readFileSync(path.join(DATA, "inventory.json"), "utf8")) as Inventory;
const { entries: ledger } = JSON.parse(readFileSync(path.join(DATA, "providers-ledger.json"), "utf8")) as {
  entries: { provider: string; call: string; params: Record<string, string>; rows: number; consumed: number | null }[];
};

/** Proveedor de cada fuente; las que no son de pago van juntas. */
const PROVIDER: Record<string, string> = {
  fantastic_ats: "Fantastic",
  fantastic_jb: "Fantastic",
  serpapi: "Google Jobs (SerpApi)",
  "apify-computrabajo": "Apify",
  "apify-linkedin": "Apify",
  "apify-indeed": "Apify",
};
const providerOf = (sourceId: string) => PROVIDER[sourceId] ?? "Gratis (ATS y portales)";

const VERTICAL: Record<RoleFamily, string> = {
  software: "Tecnología",
  datos: "Tecnología",
  producto: "Tecnología",
  diseno: "Tecnología",
  marketing: "Marketing",
  ventas: "Ventas",
  atencion_cliente: "Atención al cliente",
  finanzas: "Finanzas y contabilidad",
  administracion: "Administración",
  rrhh: "RR. HH.",
  logistica: "Logística y operaciones",
  operaciones: "Logística y operaciones",
  salud: "Salud",
  educacion: "Educación",
  legal: "Legal",
  consultoria: "Consultoría",
  produccion: "Industria, producción y oficios",
  gastronomia: "Gastronomía y hotelería",
  comercio: "Comercio y retail",
  seguridad: "Seguridad",
  entrenamiento_ia: "IA, idiomas y tareas por proyecto",
  otros: "Otros (sin clasificar)",
};

const inc = (o: Record<string, number>, k: string, n = 1) => (o[k] = (o[k] ?? 0) + n);

// --- Gasto y filas recibidas ---
const ACTOR_SOURCE: [RegExp, string][] = [
  [/computrabajo/i, "apify-computrabajo"],
  [/linkedin/i, "apify-linkedin"],
  [/indeed/i, "apify-indeed"],
];
const rowsBySource: Record<string, number> = {};
const estUsdBySource: Record<string, number> = {};
const calls: Record<string, number> = {};
for (const e of ledger) {
  if (e.provider === "apify" && e.call === "run") {
    const src = ACTOR_SOURCE.find(([re]) => re.test(e.params.actor ?? ""))?.[1] ?? "apify-otro";
    inc(rowsBySource, src, e.rows);
    inc(estUsdBySource, src, e.consumed ?? 0);
    inc(calls, src);
  } else if (e.provider === "serpapi" && e.call === "google_jobs") {
    inc(rowsBySource, "serpapi", e.rows);
    inc(calls, "serpapi");
  } else if (e.provider === "fantastic" && e.call !== "active-ats-count") {
    const src = e.call === "active-jb" ? "fantastic_jb" : "fantastic_ats";
    inc(rowsBySource, src, e.rows);
    inc(calls, src);
  }
}
const apifyEst = Object.values(estUsdBySource).reduce((a, b) => a + b, 0);
const usdBySource: Record<string, number> = {};
for (const [s, est] of Object.entries(estUsdBySource)) usdBySource[s] = apifyRealUsd !== null && apifyEst ? (est / apifyEst) * apifyRealUsd : est;

// --- Publicaciones, verticales y duplicación ---
const opps = opportunitiesOf(inv);
const byKey = new Map(inv.postings.map((p) => [p.key, p]));
const oppOf = new Map<string, (typeof opps)[number]>();
for (const o of opps) for (const k of o.postingKeys) oppOf.set(k, o);
const FREE = (p: StoredPosting) => providerOf(p.sourceId).startsWith("Gratis");

type Row = { total: number; open: number; eligible: number; dupAny: number; dupFree: number; dupPaid: number; rows: number; usd: number | null; calls: number; verticals: Record<string, number> };
const bySource: Record<string, Row> = {};
for (const p of inv.postings) {
  const r = (bySource[p.sourceId] ??= { total: 0, open: 0, eligible: 0, dupAny: 0, dupFree: 0, dupPaid: 0, rows: rowsBySource[p.sourceId] ?? 0, usd: null, calls: calls[p.sourceId] ?? 0, verticals: {} });
  r.total++;
  if (p.status !== "abierta") continue;
  r.open++;
  const o = oppOf.get(p.key)!;
  if (o.eligibility.status === "elegible") r.eligible++;
  inc(r.verticals, VERTICAL[p.extracted.family.value] ?? "Otros (sin clasificar)");
  const others = o.postingKeys.map((k) => byKey.get(k)!).filter((q) => q && q.key !== p.key && q.status === "abierta" && q.sourceId !== p.sourceId);
  if (others.length) r.dupAny++;
  if (others.some(FREE)) r.dupFree++;
  if (others.some((q) => !FREE(q))) r.dupPaid++;
}
for (const [s, r] of Object.entries(bySource)) {
  if (s.startsWith("apify")) r.usd = usdBySource[s] ?? 0;
  else if (PROVIDER[s]) r.usd = 0;
}

// Mismo puesto publicado varias veces dentro de la misma fuente (una por ciudad): lo que agrupa la web.
const openOpps = opps.filter((o) => o.status === "abierta");
const grouped = groupOpportunities(openOpps).opportunities.filter((o) => o.status === "abierta");

const report = {
  generatedAt: inv.generatedAt,
  apifyRealUsd,
  apifyLedgerEstimateUsd: Math.round(apifyEst * 1000) / 1000,
  catalog: {
    publicacionesAbiertas: inv.postings.filter((p) => p.status === "abierta").length,
    oportunidadesCanonicasAbiertas: openOpps.length,
    gruposVisiblesAbiertos: grouped.length,
    duplicacionEntreFuentesPct: pct(1 - openOpps.length / inv.postings.filter((p) => p.status === "abierta").length),
    mismoPuestoVariasCiudadesPct: pct(1 - grouped.length / openOpps.length),
  },
  bySource,
};
function pct(x: number) {
  return Math.round(x * 1000) / 10;
}

const out = arg("out");
if (out) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

// Resumen legible.
console.log(`Catálogo: ${report.catalog.publicacionesAbiertas} publicaciones abiertas → ${report.catalog.oportunidadesCanonicasAbiertas} oportunidades → ${report.catalog.gruposVisiblesAbiertos} grupos visibles.`);
console.log(`Duplicación entre fuentes: ${report.catalog.duplicacionEntreFuentesPct}% · mismo puesto en varias ciudades: ${report.catalog.mismoPuestoVariasCiudadesPct}%`);
for (const [s, r] of Object.entries(bySource).sort((a, b) => b[1].open - a[1].open)) {
  const usd = r.usd === null ? "gratis" : `US$${r.usd.toFixed(2)}`;
  console.log(
    `${s.padEnd(20)} ${providerOf(s).padEnd(24)} filas ${String(r.rows).padStart(5)} · guardadas ${String(r.total).padStart(5)} · abiertas ${String(r.open).padStart(5)} · elegibles ${String(r.eligible).padStart(5)} · dup ${pct(r.dupAny / (r.open || 1))}% (gratis ${pct(r.dupFree / (r.open || 1))}%) · ${usd}`,
  );
}
