import { createHash } from "node:crypto";
import { cleanUrl, companyDomain, companyIdFor, detectProvider, fold, slugify } from "./identity";
import type { Row, Sheet } from "./tabular";
import type { Company, CompanySource, PilotJob, TargetCompany, TargetsDoc } from "./types";

/**
 * Importación del Sheet "Research Laboral" (XLSX con tres pestañas, o un CSV por vez).
 *
 * Cada pestaña tiene secciones: empresas LatAm y Global (con su encabezado), después `JOB OPENINGS · PILOTO`
 * (vacantes históricas, que van aparte y nunca como empresas) y `COBERTURA DEL PILOTO` (se ignora).
 * Las empresas se deduplican por identidad (dominio, o nombre exacto si no hay dominio) y conservan todas
 * sus etiquetas de sector. Importar dos veces no duplica nada ni pisa prioridades ni notas.
 */

export { COMPANY_FIELD_LABELS, JOB_FIELD_LABELS, type CompanyField, type JobField } from "./fields";
import { COMPANY_FIELD_LABELS, type CompanyField, type JobField } from "./fields";

const COMPANY_SYNONYMS: [CompanyField, RegExp][] = [
  ["rank", /^(#|n°|nro|ranking|rank|ranking regional|posicion|puesto en el ranking)$|ranking/],
  ["name", /^(empresa|compania|company|nombre|organizacion|startup)$/],
  ["headquarters", /^(sede|hq|headquarters|casa matriz|ubicacion|pais|ciudad)$|sede/],
  ["stage", /^(etapa|stage|ronda|serie|fase)$|etapa/],
  ["employees", /empleado|headcount|tamano|employees|dotacion/],
  ["activity", /^(actividad|descripcion|que hace|description|activity)$|actividad/],
  ["areas", /areas/],
  ["linkStatus", /estado/],
  ["careers", /careers|empleos|trabaja con nosotros|jobs|bolsa/],
  ["sources", /^(fuentes?|sources?|referencias?)$/],
  ["notes", /^(notas?|comentarios?|observaciones?|notes?)$/],
  ["website", /^(web|sitio|sitio web|website|dominio|url)$/],
  ["industry", /^(sector|industria|vertical)$/],
  ["region", /^(region|mercado)$/],
];

const JOB_SYNONYMS: [JobField, RegExp][] = [
  ["priority", /^prioridad$|prioridad/],
  ["score", /score|puntaje|\/100/],
  ["company", /^(empresa|compania|company)$/],
  ["location", /ubicacion|lugar|location|modalidad/],
  ["title", /^(puesto|rol|titulo|vacante|cargo|posicion|role|title)$/],
  ["fsgp", /f\s*\/\s*s\s*\/\s*g\s*\/\s*p|fsgp/],
  ["reasons", /motivo|por que|razon/],
  ["barriers", /barrera/],
  ["url", /^(url|link|enlace|aviso)$/],
  ["evidence", /evidencia/],
  ["date", /fecha/],
  ["action", /accion|siguiente paso|proximo paso/],
];

function guess<T extends string>(header: string, synonyms: [T, RegExp][]): T | null {
  const h = fold(header).replace(/[:*]+$/g, "").trim();
  if (!h) return null;
  for (const [field, re] of synonyms) if (re.test(h)) return field;
  return null;
}

export type ColumnMap<T extends string> = { index: number; header: string; field: T }[];

/** Mapeo de columnas elegido por la persona en la vista previa: por pestaña, tipo de tabla y número de columna. */
export type MappingOverrides = Record<string, { companies?: Record<number, CompanyField>; jobs?: Record<number, JobField> }>;

type Mode = "companies" | "jobs" | "coverage";

const nonEmpty = (r: Row) => r.cells.filter((c) => c.trim()).length;
const joined = (r: Row) => fold(r.cells.filter((c) => c.trim()).join(" "));

function marker(r: Row): { kind: "jobs" | "coverage" | "region"; region?: string } | null {
  if (nonEmpty(r) === 0 || nonEmpty(r) > 2) return null;
  const t = joined(r);
  if (t.length > 90) return null;
  if (/job openings|vacantes del piloto/.test(t)) return { kind: "jobs" };
  if (/cobertura/.test(t)) return { kind: "coverage" };
  if (/\blatam\b|latinoamerica|america latina/.test(t)) return { kind: "region", region: "LatAm" };
  if (/\bglobal\b|resto del mundo|internacional/.test(t)) return { kind: "region", region: "Global" };
  return null;
}

function headerMap<T extends string>(r: Row, synonyms: [T, RegExp][], overrides?: Record<number, T>): ColumnMap<T> {
  const used = new Set<T>();
  const out: ColumnMap<T> = [];
  r.cells.forEach((header, index) => {
    if (!header.trim()) return;
    let field = overrides?.[index] ?? guess(header, synonyms);
    // Una columna por campo: si se repite, la segunda queda sin importar (se puede cambiar en la vista previa).
    if (field && field !== "ignore" && used.has(field) && overrides?.[index] === undefined) field = null;
    if (field && field !== "ignore") used.add(field);
    out.push({ index, header: header.trim(), field: (field ?? "ignore") as T });
  });
  return out;
}

const hasFields = <T extends string>(m: ColumnMap<T>, ...fields: T[]) => fields.every((f) => m.some((c) => c.field === f));
const known = <T extends string>(m: ColumnMap<T>) => m.filter((c) => c.field !== "ignore").length;

export function industryFromTab(name: string): string {
  const t = fold(name);
  if (/^ia\b|inteligencia artificial|^ai\b|\bai\b/.test(t)) return "IA";
  if (/space|espacial/.test(t)) return "Space";
  if (/tech startups?|startups?/.test(t)) return "Tech Startups";
  return name.split(/[·|-]/)[0].trim() || name.trim();
}

export type CompanyRow = {
  tab: string;
  row: number;
  industry: string;
  region: string;
  values: Partial<Record<CompanyField, string>>;
  links: Partial<Record<CompanyField, string>>;
};
export type JobRow = { tab: string; row: number; industry: string; values: Partial<Record<JobField, string>>; links: Partial<Record<JobField, string>> };
export type RowIssue = { tab: string; row: number; message: string };

export type TabAnalysis = {
  name: string;
  industry: string;
  companyColumns: ColumnMap<CompanyField> | null;
  jobColumns: ColumnMap<JobField> | null;
  sections: { label: string; rows: number }[];
  companyRows: number;
  jobRows: number;
  coverageRows: number;
  ignoredRows: number;
};

export type Analysis = { tabs: TabAnalysis[]; companies: CompanyRow[]; jobs: JobRow[]; errors: RowIssue[]; ignoredRows: number };

function pick<T extends string>(r: Row, cols: ColumnMap<T>) {
  const values: Partial<Record<T, string>> = {};
  const links: Partial<Record<T, string>> = {};
  for (const c of cols) {
    if (c.field === "ignore") continue;
    const v = (r.cells[c.index] ?? "").trim();
    const l = r.links[c.index];
    if (v) values[c.field] = values[c.field] ? `${values[c.field]} ${v}` : v;
    if (l) links[c.field] = l;
  }
  return { values, links };
}

/** Recorre las pestañas y separa empresas, vacantes del piloto y filas ignoradas. */
export function analyze(sheets: Sheet[], opts: { overrides?: MappingOverrides; industryOverride?: Record<string, string> } = {}): Analysis {
  const out: Analysis = { tabs: [], companies: [], jobs: [], errors: [], ignoredRows: 0 };
  for (const sheet of sheets) {
    const industry = opts.industryOverride?.[sheet.name]?.trim() || industryFromTab(sheet.name);
    const tab: TabAnalysis = { name: sheet.name, industry, companyColumns: null, jobColumns: null, sections: [], companyRows: 0, jobRows: 0, coverageRows: 0, ignoredRows: 0 };
    const ov = opts.overrides?.[sheet.name];
    let mode: Mode = "companies";
    let region = "";
    let companyCols: ColumnMap<CompanyField> | null = null;
    let jobCols: ColumnMap<JobField> | null = null;
    let section = { label: "Empresas", rows: 0 };
    const startSection = (label: string) => {
      if (section.rows) tab.sections.push(section);
      section = { label, rows: 0 };
    };

    sheet.rows.forEach((r, i) => {
      const rowNumber = i + 1;
      if (!nonEmpty(r)) return;
      const m = marker(r);
      if (m) {
        if (m.kind === "jobs") { mode = "jobs"; startSection("Job openings · piloto"); }
        else if (m.kind === "coverage") { mode = "coverage"; startSection("Cobertura del piloto (ignorada)"); }
        else if (mode !== "coverage") { mode = "companies"; region = m.region ?? ""; startSection(`Empresas ${region}`); }
        return;
      }
      if (mode === "coverage") { tab.coverageRows++; section.rows++; return; }
      if (mode === "companies") {
        const h = headerMap(r, COMPANY_SYNONYMS, ov?.companies);
        if (hasFields(h, "name") && known(h) >= 2) { companyCols = h; tab.companyColumns ??= h; return; }
        // Un encabezado de vacantes sin el título de sección también abre la tabla del piloto.
        const hj = headerMap(r, JOB_SYNONYMS, ov?.jobs);
        if (hasFields(hj, "company", "title") && hasFields(hj, "score") && companyCols) { mode = "jobs"; jobCols = hj; tab.jobColumns ??= hj; startSection("Job openings · piloto"); return; }
        if (!companyCols) { tab.ignoredRows++; return; }
        const { values, links } = pick(r, companyCols);
        if (!values.name) {
          if (nonEmpty(r) >= 2) out.errors.push({ tab: sheet.name, row: rowNumber, message: "Falta el nombre de la empresa: no se importó la fila." });
          else tab.ignoredRows++;
          return;
        }
        out.companies.push({ tab: sheet.name, row: rowNumber, industry: values.industry?.trim() || industry, region: values.region?.trim() || region, values, links });
        tab.companyRows++;
        section.rows++;
        return;
      }
      // mode === "jobs"
      const hj = headerMap(r, JOB_SYNONYMS, ov?.jobs);
      if (hasFields(hj, "company", "title")) { jobCols = hj; tab.jobColumns ??= hj; return; }
      if (!jobCols) { tab.ignoredRows++; return; }
      const { values, links } = pick(r, jobCols);
      if (!values.company || !values.title) {
        out.errors.push({ tab: sheet.name, row: rowNumber, message: "Vacante del piloto sin empresa o sin puesto: no se importó." });
        return;
      }
      out.jobs.push({ tab: sheet.name, row: rowNumber, industry, values, links });
      tab.jobRows++;
      section.rows++;
    });
    if (section.rows) tab.sections.push(section);
    out.ignoredRows += tab.ignoredRows + tab.coverageRows;
    out.tabs.push(tab);
  }
  return out;
}

/* ---------- Plan: dedup contra el catálogo y el seguimiento ---------- */

export type Notice = { kind: "fusion" | "conflicto" | "dato"; message: string };

export type PlannedCompany = {
  company: Company;
  isNew: boolean;
  changed: boolean;
  rows: number;
  industries: string[];
  following: boolean;
};

export type ImportPlan = {
  companies: PlannedCompany[];
  sources: Record<string, CompanySource[]>;
  targets: TargetsDoc;
  targetsCreated: number;
  targetsKept: number;
  pilotJobs: PilotJob[];
  notices: Notice[];
  errors: RowIssue[];
  ignoredRows: number;
};

const uniq = (xs: string[]) => {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = fold(x);
    if (!x.trim() || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const splitList = (s?: string) => (s ? s.split(/\s*[;,|\n•]\s*|\s+\/\s+/).map((x) => x.trim()).filter(Boolean) : []);
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

const urlOf = (value?: string, link?: string) => {
  for (const c of [link, value]) {
    const u = c ? cleanUrl(c) : null;
    if (u && /\./.test(c ?? "")) return u;
  }
  return null;
};

function emptyCompany(id: string, name: string, domain: string | null, now: string): Company {
  return {
    id,
    identity: domain ? "dominio" : "provisoria",
    canonicalDomain: domain,
    domainVerified: false,
    slug: slugify(name),
    name,
    aliases: [],
    description: "",
    headquarters: "",
    stage: "",
    employeeBand: "",
    suggestedAreas: [],
    industries: [],
    region: "",
    rankings: [],
    references: [],
    metadataSource: null,
    createdAt: now,
    updatedAt: now,
  };
}

const SCALARS = [
  ["description", "activity"],
  ["headquarters", "headquarters"],
  ["stage", "stage"],
  ["employeeBand", "employees"],
] as const;

export function excelDate(v: string): string {
  const n = Number(v);
  if (/^\d{5}(\.\d+)?$/.test(v) && n > 30000 && n < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return v;
}

/**
 * Arma lo que haría la importación sin escribir nada. `catalog` es el catálogo completo y `targets` el
 * seguimiento de la persona. Determinista: con el mismo archivo y el mismo estado da lo mismo.
 */
export function planImport(
  a: Analysis,
  state: { catalog: Company[]; sources: Record<string, CompanySource[]>; targets: TargetsDoc; pilot: PilotJob[] },
  now = new Date(),
  sourceLabel = "Research Laboral (importado)",
): ImportPlan {
  const iso = now.toISOString();
  const byId = new Map(state.catalog.map((c) => [c.id, structuredClone(c)]));
  const original = new Map(state.catalog.map((c) => [c.id, JSON.stringify(c)]));
  const byDomain = new Map<string, string>();
  const byName = new Map<string, Set<string>>();
  const indexName = (name: string, id: string) => {
    const k = fold(name);
    if (!byName.has(k)) byName.set(k, new Set());
    byName.get(k)!.add(id);
  };
  for (const c of byId.values()) {
    if (c.canonicalDomain) byDomain.set(c.canonicalDomain, c.id);
    indexName(c.name, c.id);
    c.aliases.forEach((al) => indexName(al, c.id));
  }

  const notices: Notice[] = [];
  const errors: RowIssue[] = [...a.errors];
  const touched = new Map<string, { rows: number; industries: Set<string>; notes: string[] }>();
  const sources: Record<string, CompanySource[]> = {};
  const conflictsSeen = new Set<string>();
  const notice = (n: Notice) => {
    if (conflictsSeen.has(n.message)) return;
    conflictsSeen.add(n.message);
    notices.push(n);
  };

  for (const r of a.companies) {
    const name = r.values.name!.trim().slice(0, 120);
    const careers = urlOf(r.values.careers, r.links.careers ?? r.links.name);
    if ((r.values.careers || r.links.careers) && !careers) errors.push({ tab: r.tab, row: r.row, message: `El link de Careers de ${name} no es válido: la empresa se importa sin fuente.` });
    const website = urlOf(r.values.website, r.links.website);
    const domain = (website && companyDomain(website)) || (careers && companyDomain(careers)) || null;

    let id: string | null = null;
    const nameHits = [...(byName.get(fold(name)) ?? [])];
    if (domain) {
      id = byDomain.get(domain) ?? null;
      if (id && fold(byId.get(id)!.name) !== fold(name)) {
        notice({ kind: "fusion", message: `«${name}» y «${byId.get(id)!.name}» comparten el dominio ${domain}: quedan como una sola empresa.` });
      }
      if (!id) {
        // Misma empresa cargada antes sin dominio (identidad provisoria): se le suma el dominio.
        const provisional = nameHits.map((h) => byId.get(h)!).filter((c) => !c.canonicalDomain);
        const withOtherDomain = nameHits.map((h) => byId.get(h)!).filter((c) => c.canonicalDomain && c.canonicalDomain !== domain);
        if (withOtherDomain.length) {
          notice({ kind: "conflicto", message: `Hay más de una «${name}» con dominios distintos (${[domain, ...withOtherDomain.map((c) => c.canonicalDomain)].join(", ")}): quedan separadas.` });
        }
        if (provisional.length === 1) {
          id = provisional[0].id;
          provisional[0].canonicalDomain = domain;
          provisional[0].identity = "dominio";
          byDomain.set(domain, id);
        }
      }
      id ??= companyIdFor(domain, name);
    } else {
      if (nameHits.length === 1) id = nameHits[0];
      else if (nameHits.length > 1) {
        const exact = companyIdFor(null, name);
        id = byId.has(exact) ? exact : null;
        notice({ kind: "conflicto", message: `«${name}» (fila ${r.row} de ${r.tab}) coincide con ${nameHits.length} empresas del catálogo y no tiene dominio para distinguirlas: ${id ? "se usó la que tiene el mismo nombre exacto" : "se creó una nueva con identidad provisoria"}.` });
      }
      id ??= companyIdFor(null, name);
    }

    let c = byId.get(id);
    if (!c) {
      c = emptyCompany(id, name, domain, iso);
      byId.set(id, c);
      if (domain) byDomain.set(domain, id);
      indexName(name, id);
    } else if (fold(c.name) !== fold(name) && !c.aliases.some((x) => fold(x) === fold(name))) {
      c.aliases = uniq([...c.aliases, name]);
      indexName(name, id);
    }

    // Completa sólo lo vacío: nunca pisa un dato que ya estaba.
    for (const [field, col] of SCALARS) {
      const v = r.values[col]?.trim();
      if (!v) continue;
      if (!c[field]) c[field] = v;
      else if (fold(c[field]) !== fold(v)) notice({ kind: "dato", message: `${c.name}: ${COMPANY_FIELD_LABELS[col].toLowerCase()} distinta entre filas («${c[field]}» y «${v}»). Se conservó la primera.` });
    }
    if (!c.region && r.region) c.region = r.region;
    c.industries = uniq([...c.industries, r.industry]);
    c.suggestedAreas = uniq([...c.suggestedAreas, ...splitList(r.values.areas)]);
    c.references = uniq([...c.references, ...splitList(r.values.sources), ...(r.links.sources ? [r.links.sources] : [])]).slice(0, 30);
    if (r.values.rank) {
      const rk = { industry: r.industry, region: r.region, rank: r.values.rank };
      if (!c.rankings.some((x) => x.industry === rk.industry && x.region === rk.region)) c.rankings = [...c.rankings, rk];
    }
    c.metadataSource ??= { label: sourceLabel, at: iso.slice(0, 10) };

    const t = touched.get(id) ?? { rows: 0, industries: new Set<string>(), notes: [] };
    t.rows++;
    t.industries.add(r.industry);
    if (r.values.notes) t.notes.push(r.values.notes.trim());
    touched.set(id, t);

    if (careers) {
      const list = sources[id] ?? [...(state.sources[id] ?? [])];
      const key = careers.replace(/\/+$/, "").toLowerCase();
      if (!list.some((s) => s.careersUrl.replace(/\/+$/, "").toLowerCase() === key)) {
        const { provider, boardId } = detectProvider(careers);
        list.push({
          id: `src_${hash(`${id}|${key}`)}`,
          companyId: id,
          provider,
          careersUrl: careers,
          externalBoardId: boardId,
          status: "pendiente",
          declaredStatus: r.values.linkStatus?.trim() ?? "",
          lastAttemptAt: null,
          lastSuccessAt: null,
          nextDueAt: null,
          failureCount: 0,
          createdAt: iso,
        });
        sources[id] = list;
      }
    }
  }

  const companies: PlannedCompany[] = [];
  for (const [id, t] of touched) {
    const c = byId.get(id)!;
    const before = original.get(id);
    const isNew = !before;
    const sameAsBefore = before && JSON.stringify({ ...c, updatedAt: "" }) === JSON.stringify({ ...JSON.parse(before), updatedAt: "" });
    const changed = isNew || !sameAsBefore;
    if (changed) c.updatedAt = iso;
    companies.push({ company: c, isNew, changed, rows: t.rows, industries: [...t.industries], following: !!state.targets.items[id] });
  }
  companies.sort((x, y) => x.company.name.localeCompare(y.company.name, "es"));

  // Seguimiento: las nuevas entran "por clasificar"; las que ya estaban quedan como estaban (prioridad, notas, orden, archivo).
  const items: Record<string, TargetCompany> = { ...state.targets.items };
  let maxPos = Math.max(0, ...Object.values(items).map((x) => x.position));
  let created = 0;
  let kept = 0;
  for (const p of companies) {
    if (items[p.company.id]) { kept++; continue; }
    created++;
    items[p.company.id] = {
      companyId: p.company.id,
      priority: null,
      position: ++maxPos,
      notes: uniq(touched.get(p.company.id)!.notes).join("\n").slice(0, 4000),
      status: "activa",
      tags: [],
      origin: "importacion",
      createdAt: iso,
      updatedAt: iso,
    };
  }

  // Vacantes del piloto: históricas, por persona, con id estable (re-importar no duplica).
  const resolveCompany = (name: string) => {
    const hits = [...(byName.get(fold(name)) ?? [])];
    return hits.length === 1 ? hits[0] : null;
  };
  const prevPilot = new Map(state.pilot.map((j) => [j.id, j]));
  const pilotJobs: PilotJob[] = [];
  const seenJobs = new Set<string>();
  for (const j of a.jobs) {
    const v = j.values;
    const url = urlOf(v.url, j.links.url ?? j.links.title) ?? "";
    const id = `pil_${hash(`${fold(v.company!)}|${fold(v.title!)}|${url.toLowerCase()}`)}`;
    if (seenJobs.has(id)) continue;
    seenJobs.add(id);
    const score = Number((v.score ?? "").replace(/[^\d.]/g, "").replace(/^(\d+(?:\.\d+)?).*/, "$1"));
    pilotJobs.push({
      id,
      companyId: resolveCompany(v.company!),
      company: v.company!.trim(),
      title: v.title!.trim(),
      location: v.location ?? "",
      priority: v.priority ?? "",
      editorialScore: Number.isFinite(score) && v.score ? Math.min(100, score) : null,
      fsgp: v.fsgp ?? "",
      reasons: v.reasons ?? "",
      barriers: v.barriers ?? "",
      url,
      evidence: v.evidence ?? "",
      date: excelDate(v.date ?? ""),
      action: v.action ?? "",
      industry: j.industry,
      importedAt: prevPilot.get(id)?.importedAt ?? iso,
    });
  }

  return {
    companies,
    sources,
    targets: { items, updatedAt: state.targets.updatedAt },
    targetsCreated: created,
    targetsKept: kept,
    pilotJobs,
    notices,
    errors,
    ignoredRows: a.ignoredRows,
  };
}
