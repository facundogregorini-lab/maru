/**
 * Importación acotada de proveedores con cuota finita: Fantastic.jobs (créditos del trial) y
 * SerpApi Google Jobs (búsquedas del plan gratuito). La corre a mano el workflow match-providers.yml;
 * la sincronización diaria nunca los consulta.
 *
 * Reglas (docs/PLAN-AVISOS.md, docs/PROVEEDORES-AVISOS.md):
 * - Nunca superar el saldo incluido: se lee el saldo antes de cada pedido y se frena si falta el dato.
 * - Sin reintentos, sin paginar Google Jobs, sin excedentes ni planes pagos.
 * - Feeds parciales: una ausencia no cierra avisos; vencen por fecha de la fuente o por no volver a verse
 *   (STALE de inventory.ts / expireImported de sync.ts). Así el catálogo sigue sano cuando termina el trial.
 * - Sin campos de reclutadores. Las claves no se registran: el ledger guarda parámetros sin api_key.
 */
import { countryIso, parseBoardUrl, workplaceFromText } from "./connectors";
import { sha } from "./hash";
import { fantasticQuota, ProviderError, request, serpAccount } from "./provider-pilot";
import { canonicalUrl, fold, htmlToText } from "./text";
import type { Field, NormalizedPosting, Salary, Workplace } from "./types";

export type ProviderFeed = "fantastic_ats" | "fantastic_jb" | "serpapi";
export const PROVIDER_BOARD: Record<ProviderFeed, string> = {
  fantastic_ats: "fantastic:ats:ar",
  fantastic_jb: "fantastic:linkedin:ar",
  serpapi: "serpapi:google_jobs:ar",
};

const DESC_MAX = 8000;
const MIN_DESCRIPTION = 300;
/** Más viejo que esto no se importa: un aviso de hace meses en un índice probablemente ya no está abierto. */
const MAX_AGE_DAYS = 45;

/** Cohortes de E1 (PLAN-AVISOS §4), con la sintaxis OR del filtro de título de Fantastic. */
export type Cohort = { id: string; label: string; title: string };
export const FANTASTIC_COHORTS: Cohort[] = [
  { id: "G1", label: "Administración, finanzas y RR. HH.", title: 'administrativo OR administrativa OR contable OR contador OR finanzas OR tesorería OR "recursos humanos" OR recruiter OR "talent acquisition" OR facturación' },
  { id: "G2", label: "Ventas, operaciones y logística", title: 'comercial OR ventas OR vendedor OR "account executive" OR operaciones OR logística OR "supply chain" OR depósito OR compras OR "atención al cliente"' },
  { id: "T1", label: "Tecnología, datos y producto", title: 'developer OR desarrollador OR "software engineer" OR "data analyst" OR "analista de datos" OR QA OR "product manager"' },
];

/**
 * Búsquedas de Google Jobs para los huecos de E0 (generalistas e interior). No incluyen los perfiles
 * de reserva (atención en Mar del Plata, datos en Neuquén) para no sesgar su comprobación.
 */
export type SerpQuery = { id: string; q: string };
export const SERP_QUERIES: SerpQuery[] = [
  { id: "adm-cba", q: "administrativo contable Córdoba" },
  { id: "fin-ros", q: "analista de finanzas Rosario" },
  { id: "rrhh-mza", q: "recursos humanos Mendoza" },
  { id: "ventas-lp", q: "vendedor La Plata" },
  { id: "log-tuc", q: "logística Tucumán" },
  { id: "adm-caba", q: "asistente administrativo Buenos Aires" },
  { id: "rrhh-caba", q: "analista de recursos humanos Buenos Aires" },
  { id: "log-caba", q: "analista de logística Buenos Aires" },
  { id: "ventas-cba", q: "ejecutivo comercial Córdoba" },
  { id: "cont-ros", q: "contador Rosario" },
  { id: "compras-mza", q: "compras Mendoza" },
  { id: "admin-tuc", q: "administrativo Tucumán" },
];

export type Rejections = Record<string, number>;
export type ImportBatch = { sourceId: string; boardId: string; postings: NormalizedPosting[]; received: number; rejected: Rejections; query: string };
export type LedgerEntry = {
  at: string;
  provider: "fantastic" | "serpapi" | "apify";
  call: string;
  params: Record<string, string>;
  rows: number;
  /** Créditos/búsquedas/US$ consumidos según el proveedor (null si no lo informó). */
  consumed: number | null;
  quota: Record<string, string | number | null>;
  error?: string;
};
export type Employer = { company: string; ats: string; host: string; supported?: { sourceId: "greenhouse" | "lever" | "ashby"; slug: string } };
export type ImportResult = { batches: ImportBatch[]; ledger: LedgerEntry[]; employers: Employer[]; stopped: string | null };

/* ---------- helpers ---------- */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strings = (v: unknown) => list(v).map(str).filter(Boolean);
const uniq = <T>(xs: T[]) => [...new Set(xs)];

function safeUrl(value: unknown, httpsOnly = false): string {
  try {
    const url = new URL(str(value));
    if (!(httpsOnly ? ["https:"] : ["http:", "https:"]).includes(url.protocol) || url.username || url.password) return "";
    if ([...url.searchParams.keys()].some((k) => /token|api.?key|secret|signature/i.test(k))) return "";
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) url.searchParams.delete(k);
    return url.href;
  } catch {
    return "";
  }
}

/** Fecha tal como llega si es válida (sin agregar zona horaria inventada). */
function dateAsIs(v: unknown): string | null {
  const s = str(v);
  return s && Number.isFinite(Date.parse(s)) ? s : null;
}

const ageDays = (iso: string, now: number) => (now - Date.parse(iso)) / 86_400_000;

function reject(rejected: Rejections, why: string) {
  rejected[why] = (rejected[why] ?? 0) + 1;
}

/** "hace 3 días", "3 days ago", "hace 2 semanas"… → días, o null si no hay número. */
export function relativeAgeDays(label: string): number | null {
  const t = fold(label);
  if (/\b(hoy|today|just posted|recien)\b/.test(t)) return 0;
  if (/\b(ayer|yesterday)\b/.test(t)) return 1;
  const m = t.match(/(\d+)\s*\+?\s*(horas?|hours?|h\b|dias?|days?|d\b|semanas?|weeks?|mes(?:es)?|months?|anos?|years?)/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  if (/^(hora|hour|h$)/.test(unit)) return 0;
  if (/^(semana|week)/.test(unit)) return n * 7;
  if (/^(mes|month)/.test(unit)) return n * 30;
  if (/^(ano|year)/.test(unit)) return n * 365;
  return n;
}

/* ---------- Fantastic.jobs ---------- */

function fantasticWorkplace(r: Record<string, unknown>, title: string): Field<Workplace> {
  const arrangement = fold(str(r.ai_work_arrangement));
  if (arrangement.includes("hybrid")) return { value: "hibrido", from: "fuente", evidence: `ai_work_arrangement: ${str(r.ai_work_arrangement)}` };
  if (arrangement.includes("remote")) return { value: "remoto", from: "fuente", evidence: `ai_work_arrangement: ${str(r.ai_work_arrangement)}` };
  if (arrangement.includes("on-site") || arrangement.includes("onsite")) return { value: "presencial", from: "fuente", evidence: `ai_work_arrangement: ${str(r.ai_work_arrangement)}` };
  if (r.remote_derived === true) return { value: "remoto", from: "fuente", evidence: "remote_derived: true" };
  if (str(r.location_type).toUpperCase() === "TELECOMMUTE") return { value: "remoto", from: "fuente", evidence: "location_type: TELECOMMUTE" };
  const fromTitle = workplaceFromText(title);
  return fromTitle === "desconocido" ? { value: "desconocido", from: "fuente" } : { value: fromTitle, from: "titulo", evidence: title };
}

/** salary_raw sigue schema.org MonetaryAmount. */
function fantasticSalary(raw: unknown): Field<Salary> | null {
  const s = obj(raw);
  const v = obj(s.value);
  const min = typeof v.minValue === "number" && v.minValue > 0 ? v.minValue : typeof v.value === "number" && v.value > 0 ? v.value : null;
  const max = typeof v.maxValue === "number" && v.maxValue > 0 ? v.maxValue : null;
  if (min === null && max === null) return null;
  const unit = fold(str(v.unitText));
  const period: Salary["period"] = unit.startsWith("hour") ? "hora" : unit.startsWith("month") ? "mes" : unit.startsWith("year") ? "anio" : "desconocido";
  return { value: { min, max, currency: str(s.currency).toUpperCase(), period }, from: "fuente" };
}

export function normalizeFantastic(rows: unknown[], feed: "fantastic_ats" | "fantastic_jb", query: string, now = Date.now()): ImportBatch {
  const rejected: Rejections = {};
  const postings: NormalizedPosting[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const r = obj(raw);
    const id = str(r.id);
    const title = str(r.title).slice(0, 300);
    const company = str(r.organization).slice(0, 200);
    const url = safeUrl(r.url);
    if (!id || !title || !company || !url) {
      reject(rejected, "faltan_campos");
      continue;
    }
    if (seen.has(id)) {
      reject(rejected, "repetido_en_la_respuesta");
      continue;
    }
    const description = htmlToText(str(r.description_text), DESC_MAX);
    if (description.length < MIN_DESCRIPTION) {
      reject(rejected, "descripcion_corta");
      continue;
    }
    const expiresAt = dateAsIs(r.date_valid_through);
    if (expiresAt && Date.parse(expiresAt) <= now) {
      reject(rejected, "vencido");
      continue;
    }
    const publishedAt = dateAsIs(r.date_posted);
    if (publishedAt && ageDays(publishedAt, now) > MAX_AGE_DAYS) {
      reject(rejected, "antiguo");
      continue;
    }
    seen.add(id);
    const source = str(r.source).toLowerCase();
    const countries = uniq(strings(r.countries_derived).map(countryIso).filter((c): c is string => !!c));
    const linkedin = feed === "fantastic_jb";
    const logo = safeUrl(r.organization_logo, true);
    postings.push({
      sourceId: feed,
      boardId: PROVIDER_BOARD[feed],
      externalId: id,
      title,
      company,
      sourceUrl: url,
      applyUrl: url,
      linkRequired: linkedin,
      attribution: linkedin ? `Publicado en ${source === "linkedin" || !source ? "LinkedIn" : source} · índice Fantastic.jobs` : `Publicado en el sitio de empleo de ${company} · índice Fantastic.jobs`,
      descriptionText: description,
      descriptionComplete: !description.endsWith("…"),
      locations: strings(r.locations_derived).slice(0, 6),
      countries,
      regionText: [],
      workplace: fantasticWorkplace(r, title),
      remoteFlag: typeof r.remote_derived === "boolean" ? r.remote_derived : null,
      employmentType: null,
      salary: fantasticSalary(r.salary_raw),
      publishedAt,
      updatedAt: null,
      expiresAt,
      employmentHint: strings(r.employment_type).map((t) => t.replace(/_/g, " ").toLowerCase()).join(", "),
      seniorityHint: str(r.seniority),
      ...(logo ? { companyLogo: logo } : {}),
    });
  }
  return { sourceId: feed, boardId: PROVIDER_BOARD[feed], postings, received: rows.length, rejected, query };
}

/** Empleadores vistos en el feed ATS: si usan un ATS que ya integramos, se pueden sumar gratis al directorio. */
export function fantasticEmployers(rows: unknown[]): Employer[] {
  const out = new Map<string, Employer>();
  for (const raw of rows) {
    const r = obj(raw);
    const url = safeUrl(r.url);
    const company = str(r.organization);
    if (!url || !company) continue;
    const host = new URL(url).hostname.toLowerCase();
    const parsed = parseBoardUrl(url);
    const key = `${fold(company)}|${host}`;
    if (out.has(key)) continue;
    out.set(key, { company: company.slice(0, 200), ats: str(r.source).toLowerCase() || "desconocido", host, ...(parsed ? { supported: { sourceId: parsed.sourceId, slug: parsed.slug } } : {}) });
  }
  return [...out.values()];
}

/* ---------- SerpApi Google Jobs ---------- */

/** Portales de origen conocidos: válidos, pero preferimos el sitio del empleador si Google lo ofrece. */
const PORTALS = /(^|\.)(linkedin\.com|bumeran\.com\.ar|zonajobs\.com\.ar|computrabajo\.com|indeed\.com|glassdoor\.com(\.ar)?|getonbrd\.com|universia\.(net|com\.ar)|empleos\.clarin\.com|hiringroom\.com|michaelpage\.com\.ar|randstad\.com\.ar|adecco\.com\.ar|manpower\.com\.ar)$/;
/** Agregadores secundarios: repiten avisos de otros sitios y suelen interponer su propia página. */
const AGGREGATORS = /(^|\.)(talent\.com|jooble\.org|jobrapido\.com|trabajo\.org|opcionempleo\.com(\.ar)?|careerjet\.com(\.ar)?|adzuna\.com(\.ar)?|whatjobs\.com|jobsora\.com|trovit\.com(\.ar)?|jobted\.com(\.ar)?|kitempleo\.com(\.ar)?|mitula\.com(\.ar)?|empleo\.com\.ar|halaxia\.com|recruit\.net|jora\.com|learn4good\.com|bebee\.com)$/;

export function pickApplyLink(options: unknown[]): { url: string; via: string } | null {
  const links = options
    .map((o) => ({ url: safeUrl(obj(o).link), via: str(obj(o).title) }))
    .filter((l) => l.url && !/(^|\.)google\.[a-z.]+$/.test(new URL(l.url).hostname));
  const rank = (u: string) => {
    const host = new URL(u).hostname.toLowerCase();
    return AGGREGATORS.test(host) ? 2 : PORTALS.test(host) ? 1 : 0;
  };
  return links.map((l, i) => ({ ...l, r: rank(l.url) * 100 + i })).sort((a, b) => a.r - b.r)[0] ?? null;
}

export function normalizeSerp(rows: unknown[], query: string, now = Date.now()): ImportBatch {
  const rejected: Rejections = {};
  const postings: NormalizedPosting[] = [];
  const seen = new Set<string>();
  for (const raw of rows) {
    const r = obj(raw);
    const title = str(r.title).slice(0, 300);
    const company = str(r.company_name).slice(0, 200);
    const link = pickApplyLink(list(r.apply_options));
    if (!title || !company || !link) {
      reject(rejected, "faltan_campos");
      continue;
    }
    if (AGGREGATORS.test(new URL(link.url).hostname.toLowerCase())) {
      reject(rejected, "solo_agregadores");
      continue;
    }
    // La misma vacante puede aparecer en varias búsquedas: el id es el destino canónico.
    const externalId = sha(canonicalUrl(link.url), 20);
    if (seen.has(externalId)) {
      reject(rejected, "repetido_en_la_respuesta");
      continue;
    }
    const highlights = list(r.job_highlights)
      .map((h) => {
        const items = strings(obj(h).items);
        return items.length ? `${str(obj(h).title)}:\n${items.map((i) => `• ${i}`).join("\n")}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
    const description = htmlToText([str(r.description), highlights].filter(Boolean).join("\n\n"), DESC_MAX);
    if (description.length < MIN_DESCRIPTION) {
      reject(rejected, "descripcion_corta");
      continue;
    }
    const ext = obj(r.detected_extensions);
    // Google Jobs da antigüedad relativa: se conserva como texto, nunca como fecha exacta.
    const postedLabel = str(ext.posted_at) || strings(r.extensions).find((v) => relativeAgeDays(v) !== null) || "";
    const age = postedLabel ? relativeAgeDays(postedLabel) : null;
    if (age !== null && age > 30) {
      reject(rejected, "antiguo");
      continue;
    }
    seen.add(externalId);
    const location = str(r.location).slice(0, 200);
    const remote = ext.work_from_home === true;
    const fromText = workplaceFromText(`${title} ${location}`);
    const workplace: Field<Workplace> = remote ? { value: "remoto", from: "fuente", evidence: "Google Jobs: trabajo desde casa" } : fromText !== "desconocido" ? { value: fromText, from: "titulo", evidence: `${title} · ${location}` } : { value: "desconocido", from: "fuente" };
    const salaryText = str(ext.salary);
    const via = link.via || str(r.via).replace(/^(v[ií]a)\s+/i, "");
    const logo = safeUrl(r.thumbnail, true);
    postings.push({
      sourceId: "serpapi",
      boardId: PROVIDER_BOARD.serpapi,
      externalId,
      title,
      company,
      sourceUrl: link.url,
      applyUrl: link.url,
      linkRequired: true,
      attribution: `Encontrado en Google Jobs · publicado en ${via || new URL(link.url).hostname.replace(/^www\./, "")}`,
      descriptionText: description,
      // Google Jobs a veces recorta la descripción: la tratamos como extracto.
      descriptionComplete: false,
      locations: location ? [location] : [],
      countries: /\bargentina\b/.test(fold(location)) ? ["AR"] : [],
      regionText: [],
      workplace,
      remoteFlag: remote ? true : null,
      employmentType: null,
      salary: /[1-9]\d/.test(salaryText) ? { value: { min: null, max: null, currency: "", period: "desconocido", text: salaryText }, from: "fuente" } : null,
      publishedAt: null,
      updatedAt: null,
      expiresAt: null,
      employmentHint: str(ext.schedule_type),
      ...(postedLabel ? { postedLabel } : {}),
      ...(logo ? { companyLogo: logo } : {}),
    });
  }
  return { sourceId: "serpapi", boardId: PROVIDER_BOARD.serpapi, postings, received: rows.length, rejected, query };
}

/* ---------- Ejecución con saldo ---------- */

export type FantasticPlan = { cohorts: string[]; feeds: ("fantastic_ats" | "fantastic_jb")[]; limit: number; maxJobs: number; timeFrame: "24h" | "7d" | "1m" };
export type SerpPlan = { queries: SerpQuery[]; maxSearches: number; reserve: number };
type Log = (msg: string) => void;

const numberOrNull = (v: string | number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Cuántos avisos pedir en el próximo request: 0 = frenar. Nunca más que el saldo informado. */
export function nextFantasticLimit(limit: number, spent: number, maxJobs: number, quota: Record<string, string | number | null>): number {
  const jobs = numberOrNull(quota["jobs-remaining"]);
  const requests = numberOrNull(quota["requests-remaining"]);
  if (jobs === null || requests === null || requests < 1) return 0;
  return Math.max(0, Math.min(limit, jobs, maxJobs - spent));
}

export async function runFantastic(key: string, plan: FantasticPlan, log: Log = () => {}, nowIso = new Date().toISOString()): Promise<ImportResult> {
  const out: ImportResult = { batches: [], ledger: [], employers: [], stopped: null };
  const cohorts = FANTASTIC_COHORTS.filter((c) => plan.cohorts.includes(c.id));
  const call = (endpoint: string, params: Record<string, string>) => {
    const url = new URL(`https://data.fantastic.jobs/v1/${endpoint}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return request(url, { Authorization: `Bearer ${key}` }, 12_000_000);
  };
  // Un conteo (sin créditos de avisos) para conocer el saldo antes de descargar.
  let quota: Record<string, string | number | null>;
  const countParams = { time_frame: plan.timeFrame, location: "Argentina" };
  try {
    const first = await call("active-ats-count", countParams);
    quota = fantasticQuota(first.headers);
    out.ledger.push({ at: nowIso, provider: "fantastic", call: "active-ats-count", params: countParams, rows: 0, consumed: 0, quota: { ...quota, count: numberOrNull(obj(first.body).count as number) } });
  } catch (e) {
    out.ledger.push({ at: nowIso, provider: "fantastic", call: "active-ats-count", params: countParams, rows: 0, consumed: null, quota: {}, error: (e as Error).message });
    out.stopped = `No se pudo leer el saldo: ${(e as Error).message}`;
    return out;
  }
  log(`Saldo Fantastic: ${quota["jobs-remaining"]} avisos, ${quota["requests-remaining"]} requests.`);
  // Los headers de saldo pueden llegar cacheados: además llevamos la cuenta propia desde el saldo inicial.
  const initialJobs = numberOrNull(quota["jobs-remaining"]);
  const initialRequests = numberOrNull(quota["requests-remaining"]);
  let spent = 0;
  let requests = 0;
  for (const cohort of cohorts) {
    for (const feed of plan.feeds) {
      const known = {
        "jobs-remaining": initialJobs === null ? null : Math.min(numberOrNull(quota["jobs-remaining"]) ?? Infinity, initialJobs - spent),
        "requests-remaining": initialRequests === null ? null : Math.min(numberOrNull(quota["requests-remaining"]) ?? Infinity, initialRequests - requests),
      };
      const limit = nextFantasticLimit(plan.limit, spent, plan.maxJobs, known);
      if (limit < 1) {
        out.stopped ??= quota["jobs-remaining"] === null ? "El proveedor no informó el saldo: no descargamos a ciegas." : "Se alcanzó el tope de la corrida o el saldo incluido.";
        return out;
      }
      const endpoint = feed === "fantastic_ats" ? "active-ats" : "active-jb";
      const params: Record<string, string> = { time_frame: plan.timeFrame, location: "Argentina", title: cohort.title, limit: String(limit), description_format: "text", ...(feed === "fantastic_jb" ? { source: "linkedin", exclude_recruiter_fields: "true" } : {}) };
      try {
        const res = await call(endpoint, params);
        if (!Array.isArray(res.body)) throw new ProviderError("Cambió el formato de los avisos.");
        const rows = res.body.slice(0, limit);
        const q = fantasticQuota(res.headers);
        const consumed = numberOrNull(q["jobs-this-request"]) ?? rows.length;
        spent += consumed;
        requests++;
        quota = { ...quota, ...q };
        out.ledger.push({ at: nowIso, provider: "fantastic", call: endpoint, params, rows: rows.length, consumed, quota: q });
        const batch = normalizeFantastic(rows, feed, `${cohort.id}: ${cohort.title}`, Date.parse(nowIso));
        out.batches.push(batch);
        if (feed === "fantastic_ats") out.employers.push(...fantasticEmployers(rows));
        log(`${cohort.id} ${endpoint}: ${rows.length} filas, ${batch.postings.length} aceptadas, consumo ${consumed}. Quedan ${q["jobs-remaining"]} avisos / ${q["requests-remaining"]} requests.`);
      } catch (e) {
        out.ledger.push({ at: nowIso, provider: "fantastic", call: endpoint, params, rows: 0, consumed: null, quota: {}, error: (e as Error).message });
        out.stopped = `${cohort.id} ${endpoint}: ${(e as Error).message} Sin reintentos.`;
        return out;
      }
    }
  }
  return out;
}

export async function runSerp(key: string, plan: SerpPlan, log: Log = () => {}, nowIso = new Date().toISOString()): Promise<ImportResult> {
  const out: ImportResult = { batches: [], ledger: [], employers: [], stopped: null };
  let account: Record<string, string | number | null>;
  try {
    account = await serpAccount(key);
  } catch (e) {
    out.stopped = (e as Error).message;
    return out;
  }
  out.ledger.push({ at: nowIso, provider: "serpapi", call: "account", params: {}, rows: 0, consumed: 0, quota: account });
  const left = numberOrNull(account.plan_searches_left);
  if (left === null) {
    out.stopped = "SerpApi no informó las búsquedas incluidas que quedan: no buscamos.";
    return out;
  }
  // Sólo búsquedas del plan (nunca total_searches_left, que incluye extras pagos).
  const allowed = Math.max(0, Math.min(plan.maxSearches, left - plan.reserve, plan.queries.length));
  log(`SerpApi ${account.plan_name ?? ""}: ${left} búsquedas incluidas; usamos ${allowed} (reserva ${plan.reserve}).`);
  if (!allowed) out.stopped = "No quedan búsquedas incluidas por encima de la reserva.";
  for (const query of plan.queries.slice(0, allowed)) {
    const params = { engine: "google_jobs", q: query.q, location: "Argentina", gl: "ar", hl: "es" };
    const url = new URL("https://serpapi.com/search.json");
    for (const [k, v] of Object.entries({ ...params, api_key: key })) url.searchParams.set(k, v);
    try {
      const { body } = await request(url);
      const data = obj(body);
      const error = str(data.error);
      // Sin resultados no es un error de la cuenta: se registra y se sigue.
      if (error && !/hasn.t returned any results/i.test(error)) throw new ProviderError("Google Jobs no devolvió la búsqueda; no se reintentó.");
      const rows = list(data.jobs_results).slice(0, 10);
      const batch = normalizeSerp(rows, query.q, Date.parse(nowIso));
      out.batches.push(batch);
      out.ledger.push({ at: nowIso, provider: "serpapi", call: "google_jobs", params, rows: rows.length, consumed: 1, quota: {} });
      log(`"${query.q}": ${rows.length} filas, ${batch.postings.length} aceptadas.`);
    } catch (e) {
      out.ledger.push({ at: nowIso, provider: "serpapi", call: "google_jobs", params, rows: 0, consumed: null, quota: {}, error: (e as Error).message });
      out.stopped = `"${query.q}": ${(e as Error).message}`;
      return out;
    }
  }
  return out;
}
