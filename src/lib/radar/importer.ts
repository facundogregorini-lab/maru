import { fold } from "@/lib/match/text";
import { identify, safeHref, sameCompany, type Identity } from "./identity";
import type { Sheet } from "./table";
import type { PilotJob, Priority, RadarState, TargetCompany } from "./types";

/**
 * Importación del Research Laboral (o de cualquier planilla de empresas) al Radar.
 * - Cada pestaña es un sector ("IA · Empresas" → IA). Dentro, filas de región ("LatAm", "Global"),
 *   el encabezado de empresas, la sección «JOB OPENINGS · PILOTO» (vacantes históricas) y «COBERTURA DEL PILOTO» (se ignora).
 * - Una empresa repetida entre sectores queda una sola vez con todas sus etiquetas.
 * - Volver a importar no duplica ni pisa prioridad, orden, notas ni lo que la persona editó.
 */

export const COMPANY_FIELDS = ["name", "rank", "region", "hq", "stage", "employees", "activity", "areas", "careersUrl", "linkStatus", "sources", "notes", "industry", "domain"] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];
export const FIELD_LABEL: Record<CompanyField, string> = {
  name: "Empresa",
  rank: "Ranking",
  region: "Región",
  hq: "Sede",
  stage: "Etapa",
  employees: "Empleados",
  activity: "Actividad",
  areas: "Áreas sugeridas",
  careersUrl: "Careers",
  linkStatus: "Estado del enlace",
  sources: "Fuentes",
  notes: "Notas",
  industry: "Sector",
  domain: "Sitio / dominio",
};

export const JOB_FIELDS = ["priority", "score", "company", "location", "title", "fsgp", "reasons", "barriers", "url", "evidence", "date", "action"] as const;
type JobField = (typeof JOB_FIELDS)[number];

export type Mapping = Partial<Record<CompanyField, number>>;

const COMPANY_HEADERS: Record<CompanyField, RegExp> = {
  name: /^(empresa|compania|company|nombre)(?![a-z0-9])/,
  rank: /^(#|ranking|rank|puesto regional|posicion|n°|nro)(?![a-z0-9])/,
  region: /^(region|mercado)(?![a-z0-9])/,
  hq: /^(sede|hq|headquarters?|pais|ubicacion|casa matriz)(?![a-z0-9])/,
  stage: /^(etapa|stage|ronda|serie)(?![a-z0-9])/,
  employees: /^(empleados|employees|tamano|headcount|plantilla)(?![a-z0-9])/,
  activity: /^(actividad|que hace|descripcion|description|producto)(?![a-z0-9])/,
  areas: /^(areas|areas laborales|areas sugeridas|roles)(?![a-z0-9])/,
  careersUrl: /^(careers|career page|empleos|trabaja|jobs|url careers|link careers|bolsa)(?![a-z0-9])/,
  linkStatus: /^(estado del enlace|estado enlace|estado link|estado)(?![a-z0-9])/,
  sources: /^(fuentes?|sources?)(?![a-z0-9])/,
  notes: /^(notas?|notes?|comentarios?|observaciones)(?![a-z0-9])/,
  industry: /^(sector|industria|industry|vertical)(?![a-z0-9])/,
  domain: /^(sitio|web|website|dominio|domain|url)$/,
};
const JOB_HEADERS: Record<JobField, RegExp> = {
  priority: /^(prioridad|priority)(?![a-z0-9])/,
  score: /^(score|puntaje)(?![a-z0-9])/,
  company: /^(empresa|company)(?![a-z0-9])/,
  location: /^(ubicacion|location|lugar)(?![a-z0-9])/,
  title: /^(puesto|rol|role|titulo|title|posicion)(?![a-z0-9])/,
  fsgp: /^(f ?\/ ?s ?\/ ?g ?\/ ?p|fsgp)(?![a-z0-9])/,
  reasons: /^(motivos?|por que|razones?)(?![a-z0-9])/,
  barriers: /^(barreras?|riesgos?)(?![a-z0-9])/,
  url: /^(url|link|aviso)(?![a-z0-9])/,
  evidence: /^(evidencia|fuente)(?![a-z0-9])/,
  date: /^(fecha|date|detectad)(?![a-z0-9])/,
  action: /^(accion|proximo paso|next)(?![a-z0-9])/,
};

const norm = (s: string) => fold(s).replace(/[^a-z0-9#°/ ]+/g, " ").replace(/\s+/g, " ").trim();

function mapHeaders<F extends string>(row: string[], patterns: Record<F, RegExp>): Partial<Record<F, number>> {
  const out: Partial<Record<F, number>> = {};
  row.forEach((cell, i) => {
    const h = norm(cell);
    if (!h) return;
    for (const f of Object.keys(patterns) as F[]) {
      if (out[f] === undefined && patterns[f].test(h)) {
        out[f] = i;
        break;
      }
    }
  });
  return out;
}

/** Sector a partir del nombre de la pestaña: "IA · Empresas" → "IA", "Space Exploration · Empresas" → "Space". */
export function industryFromSheet(name: string): string {
  const head = name.split(/[·|•\-–—]/)[0].trim();
  const f = fold(head);
  if (/^space/.test(f) || f.includes("espacial")) return "Space";
  if (/^(ia|ai|inteligencia artificial)(?![a-z0-9])/.test(f)) return "IA";
  if (f.includes("startup")) return "Tech Startups";
  return head || name.trim();
}

const isSection = (row: string[], re: RegExp) => {
  const cells = row.map((c) => c.trim()).filter(Boolean);
  return cells.length > 0 && cells.length <= 2 && re.test(norm(cells[0]));
};
const JOBS_SECTION = /^job openings(?![a-z0-9])/;
const COVERAGE_SECTION = /^cobertura(?![a-z0-9])/;
const REGION_ROW = /^(latam|latinoamerica|america latina|global|resto del mundo|internacional)(?![a-z0-9])/;

export type SheetPlan = {
  sheet: string;
  industry: string;
  /** Si la pestaña parece de empresas (tiene encabezado con "Empresa"). */
  usable: boolean;
  headerRow: number;
  mapping: Mapping;
  /** Encabezados originales, para que la persona corrija el mapeo. */
  headers: string[];
};

/** Primera pasada: detecta encabezado y columnas de cada pestaña. */
export function planSheets(sheets: Sheet[]): SheetPlan[] {
  return sheets.map((s) => {
    let headerRow = -1;
    let mapping: Mapping = {};
    for (let r = 0; r < Math.min(s.rows.length, 40); r++) {
      if (isSection(s.rows[r], JOBS_SECTION)) break;
      const m = mapHeaders(s.rows[r], COMPANY_HEADERS);
      if (m.name !== undefined && Object.keys(m).length >= 2) {
        headerRow = r;
        mapping = m;
        break;
      }
    }
    return { sheet: s.name, industry: industryFromSheet(s.name), usable: headerRow >= 0, headerRow, mapping, headers: headerRow >= 0 ? s.rows[headerRow] : [] };
  });
}

export type ParsedCompany = {
  row: number;
  sheet: string;
  name: string;
  identity: Identity;
  fields: Partial<Record<CompanyField, string>>;
  industries: string[];
  region?: string;
};

export type RowError = { sheet: string; row: number; message: string };

export type Parsed = { companies: ParsedCompany[]; jobs: (Omit<PilotJob, "companyId"> & { sheet: string })[]; errors: RowError[]; ignoredCoverage: number; pilotDate?: string };

/** Segunda pasada: lee filas con el mapeo (posiblemente corregido) de cada pestaña. */
export function parseSheets(sheets: Sheet[], plans: SheetPlan[]): Parsed {
  const companies: ParsedCompany[] = [];
  const jobs: Parsed["jobs"] = [];
  const errors: RowError[] = [];
  let ignoredCoverage = 0;
  let pilotDate: string | undefined;

  sheets.forEach((s, si) => {
    const plan = plans[si];
    if (!plan?.usable) return;
    let mode: "empresas" | "vacantes" | "cobertura" = "empresas";
    let region: string | undefined;
    let jobMap: Partial<Record<JobField, number>> | null = null;
    const cell = (row: string[], i: number | undefined) => (i === undefined ? "" : (row[i] ?? "").trim());
    const link = (r: number, i: number | undefined) => (i === undefined ? undefined : s.links[`${r},${i}`]);

    for (let r = plan.headerRow + 1; r < s.rows.length; r++) {
      const row = s.rows[r];
      if (!row.some((c) => c.trim())) continue;
      if (isSection(row, COVERAGE_SECTION)) {
        mode = "cobertura";
        continue;
      }
      if (isSection(row, JOBS_SECTION)) {
        mode = "vacantes";
        jobMap = null;
        const when = row.join(" ").match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[1];
        if (when) pilotDate = when;
        continue;
      }
      if (mode === "cobertura") {
        ignoredCoverage++;
        continue;
      }
      if (mode === "vacantes") {
        if (!jobMap) {
          const m = mapHeaders(row, JOB_HEADERS);
          if (m.title !== undefined && m.company !== undefined) jobMap = m;
          continue;
        }
        const title = cell(row, jobMap.title);
        const company = cell(row, jobMap.company);
        if (!title || !company) continue;
        const score = Number(cell(row, jobMap.score).replace(",", ".").match(/\d+(\.\d+)?/)?.[0]);
        const url = link(r, jobMap.url) ?? cell(row, jobMap.url);
        jobs.push({
          id: `piloto:${fold(company)}:${fold(title)}`.slice(0, 160),
          sheet: s.name,
          company,
          title,
          location: cell(row, jobMap.location),
          score: Number.isFinite(score) && score >= 0 && score <= 100 ? Math.round(score) : null,
          priority: cell(row, jobMap.priority),
          reasons: cell(row, jobMap.reasons),
          barriers: cell(row, jobMap.barriers),
          url: safeHref(url) ?? "",
          evidence: cell(row, jobMap.evidence),
          date: cell(row, jobMap.date),
          action: cell(row, jobMap.action),
          industry: plan.industry,
        });
        continue;
      }
      // Empresas
      if (isSection(row, REGION_ROW) && plan.mapping.name !== undefined && !cell(row, plan.mapping.careersUrl)) {
        const label = norm(row.find((c) => c.trim()) ?? "");
        region = /^global|^resto|^internacional/.test(label) ? "Global" : "LatAm";
        continue;
      }
      const name = cell(row, plan.mapping.name);
      if (!name) continue;
      if (norm(name) === "empresa" || norm(name) === "company") continue; // encabezado repetido
      if (name.length > 120) {
        errors.push({ sheet: s.name, row: r + 1, message: "El nombre de la empresa es demasiado largo." });
        continue;
      }
      const fields: Partial<Record<CompanyField, string>> = {};
      for (const f of COMPANY_FIELDS) {
        const v = cell(row, plan.mapping[f]);
        if (v) fields[f] = v.slice(0, 1000);
      }
      const careersRaw = link(r, plan.mapping.careersUrl) ?? fields.careersUrl;
      const careers = careersRaw ? safeHref(careersRaw) : null;
      if (careersRaw && !careers) errors.push({ sheet: s.name, row: r + 1, message: `«${name}»: el link de Careers no es una URL válida; se importa sin link.` });
      if (careers) fields.careersUrl = careers;
      else delete fields.careersUrl;
      const extra = fields.industry ? fields.industry.split(/[,;/|]/).map((x) => industryFromSheet(x.trim())).filter(Boolean) : [];
      companies.push({
        row: r + 1,
        sheet: s.name,
        name,
        identity: identify({ name, careersUrl: careers ?? undefined, domain: fields.domain }),
        fields,
        industries: [...new Set([plan.industry, ...extra])],
        region: fields.region ? (/global/i.test(fields.region) ? "Global" : /lat/i.test(fields.region) ? "LatAm" : fields.region) : region,
      });
    }
  });
  return { companies, jobs, errors, ignoredCoverage, pilotDate };
}

export type ImportPreview = {
  /** Empresas únicas del archivo (ya deduplicadas entre pestañas). */
  unique: ParsedCompany[];
  /** Filas del archivo que eran la misma empresa que otra (por pestaña). */
  duplicatesInFile: number;
  create: ParsedCompany[];
  /** Ya seguidas: sólo se suman etiquetas y datos vacíos. */
  merge: { company: ParsedCompany; targetId: string; addsIndustries: string[] }[];
  /** Mismo nombre que una empresa seguida pero con otro dominio o bolsa: no se fusionan solas. */
  conflicts: { company: ParsedCompany; targetId: string; reason: string }[];
  errors: RowError[];
  jobs: number;
  ignoredCoverage: number;
  bySheet: { sheet: string; industry: string; rows: number }[];
};

function mergeParsed(a: ParsedCompany, b: ParsedCompany): ParsedCompany {
  const fields = { ...b.fields, ...a.fields };
  return {
    ...a,
    identity: a.identity.identity === "nombre" && b.identity.identity !== "nombre" ? b.identity : a.identity,
    fields,
    industries: [...new Set([...a.industries, ...b.industries])],
    region: a.region ?? b.region,
  };
}

/** Deduplica el archivo y lo compara con lo que la persona ya sigue. No modifica nada. */
export function previewImport(parsed: Parsed, state: RadarState): ImportPreview {
  const unique: ParsedCompany[] = [];
  let duplicatesInFile = 0;
  for (const c of parsed.companies) {
    const i = unique.findIndex((u) => sameCompany(u.identity, c.identity));
    if (i >= 0) {
      unique[i] = mergeParsed(unique[i], c);
      duplicatesInFile++;
    } else unique.push(c);
  }
  const targets = Object.values(state.companies);
  const create: ImportPreview["create"] = [];
  const merge: ImportPreview["merge"] = [];
  const conflicts: ImportPreview["conflicts"] = [];
  for (const c of unique) {
    const existing = targets.find((t) => sameCompany({ domain: t.domain, board: t.board, nameKey: identifyTarget(t) }, c.identity));
    if (existing) {
      merge.push({ company: c, targetId: existing.id, addsIndustries: c.industries.filter((x) => !existing.industries.includes(x)) });
      continue;
    }
    const sameName = targets.find((t) => identifyTarget(t) === c.identity.nameKey);
    if (sameName) {
      conflicts.push({ company: c, targetId: sameName.id, reason: `Ya seguís «${sameName.name}» con ${sameName.domain ?? sameName.board ?? "otro dato"}; en el archivo figura con ${c.identity.domain ?? c.identity.board ?? "otro dato"}.` });
      continue;
    }
    create.push(c);
  }
  const bySheet = [...new Set(parsed.companies.map((c) => c.sheet))].map((sheet) => ({
    sheet,
    industry: parsed.companies.find((c) => c.sheet === sheet)!.industries[0],
    rows: parsed.companies.filter((c) => c.sheet === sheet).length,
  }));
  return { unique, duplicatesInFile, create, merge, conflicts, errors: parsed.errors, jobs: parsed.jobs.length, ignoredCoverage: parsed.ignoredCoverage, bySheet };
}

const identifyTarget = (t: TargetCompany) => identify({ name: t.name }).nameKey;

const num = (s: string | undefined) => {
  const n = Number((s ?? "").match(/\d+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export type ImportOptions = {
  /** Prioridad sugerida para las nuevas según el ranking del archivo (primeras 20 → P1, siguientes 100 → P2, resto P3). */
  suggestPriority: boolean;
  /** Fusionar también los conflictos (la persona confirmó que son la misma). */
  mergeConflicts: boolean;
  now?: number;
};

export type ImportResult = { state: RadarState; created: number; updated: number; unchanged: number; jobs: number };

/** Aplica la importación. Idempotente: importar dos veces el mismo archivo no cambia nada la segunda vez. */
export function applyImport(state: RadarState, parsed: Parsed, opts: ImportOptions): ImportResult {
  const now = opts.now ?? Date.now();
  const preview = previewImport(parsed, state);
  const companies = { ...state.companies };
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  const merges = [...preview.merge, ...(opts.mergeConflicts ? preview.conflicts.map((c) => ({ company: c.company, targetId: c.targetId, addsIndustries: [] as string[] })) : [])];
  for (const m of merges) {
    const t = companies[m.targetId];
    if (!t) continue;
    const next = fillEmpty(t, m.company);
    if (JSON.stringify(next) === JSON.stringify(t)) unchanged++;
    else {
      companies[t.id] = { ...next, updatedAt: now };
      updated++;
    }
  }

  const fresh = [...preview.create].sort((a, b) => (num(a.fields.rank) ?? 999) - (num(b.fields.rank) ?? 999));
  const maxPos = Math.max(0, ...Object.values(companies).map((c) => c.position));
  fresh.forEach((c, i) => {
    let id = c.identity.id;
    for (let n = 2; companies[id]; n++) id = `${c.identity.id}~${n}`;
    const priority: Priority | null = opts.suggestPriority ? (i < 20 ? "P1" : i < 120 ? "P2" : "P3") : null;
    companies[id] = {
      id,
      identity: c.identity.identity,
      name: c.name,
      domain: c.identity.domain,
      board: c.identity.board,
      careersUrl: c.fields.careersUrl,
      industries: c.industries,
      region: c.region,
      hq: c.fields.hq,
      stage: c.fields.stage,
      employees: c.fields.employees,
      activity: c.fields.activity,
      areas: c.fields.areas,
      research: researchOf(c),
      rank: num(c.fields.rank),
      priority,
      position: maxPos + i + 1,
      notes: "",
      archived: false,
      origin: "importada",
      createdAt: now,
      updatedAt: now,
    };
    created++;
  });

  const all = Object.values(companies);
  const pilotIds = new Set(state.pilot.map((p) => p.id));
  const pilot = [...state.pilot];
  for (const j of parsed.jobs) {
    if (pilotIds.has(j.id)) continue;
    pilotIds.add(j.id);
    const key = identify({ name: j.company }).nameKey;
    const target = all.find((t) => identify({ name: t.name }).nameKey === key);
    const { sheet: _sheet, ...job } = j;
    void _sheet;
    pilot.push({ ...job, companyId: target?.id ?? null });
  }
  const jobsAdded = pilot.length - state.pilot.length;
  const changed = created > 0 || updated > 0 || jobsAdded > 0;
  return {
    state: changed ? { ...state, companies, pilot, pilotDate: state.pilotDate ?? parsed.pilotDate, updatedAt: now } : state,
    created,
    updated,
    unchanged,
    jobs: jobsAdded,
  };
}

function researchOf(c: ParsedCompany): string | undefined {
  const parts = [c.fields.sources && `Fuentes: ${c.fields.sources}`, c.fields.notes && `Notas: ${c.fields.notes}`, c.fields.linkStatus && `Estado del enlace: ${c.fields.linkStatus}`].filter(Boolean);
  return parts.length ? parts.join("\n").slice(0, 2000) : undefined;
}

/** Suma etiquetas y completa datos vacíos. Nunca toca prioridad, orden, notas personales ni archivo. */
function fillEmpty(t: TargetCompany, c: ParsedCompany): TargetCompany {
  const empty = (x: unknown) => x === undefined || x === null || x === "";
  const pick = <K extends keyof TargetCompany>(k: K, v: TargetCompany[K] | undefined): TargetCompany[K] => (empty(t[k]) && v !== undefined ? v : t[k]);
  return {
    ...t,
    industries: [...new Set([...t.industries, ...c.industries])],
    domain: pick("domain", c.identity.domain),
    board: pick("board", c.identity.board),
    careersUrl: pick("careersUrl", c.fields.careersUrl),
    region: pick("region", c.region),
    hq: pick("hq", c.fields.hq),
    stage: pick("stage", c.fields.stage),
    employees: pick("employees", c.fields.employees),
    activity: pick("activity", c.fields.activity),
    areas: pick("areas", c.fields.areas),
    research: pick("research", researchOf(c)),
    rank: pick("rank", num(c.fields.rank)),
  };
}
