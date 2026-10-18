import { fetchJson, fetchText, postJson, type RetryOptions } from "./http";
import { decodeEntities, fold, htmlToText } from "./text";
import type { Field, NormalizedPosting, Salary, Workplace } from "./types";

/**
 * Conectores independientes: cada uno sabe pedir el listado de UNA bolsa (empresa o portal)
 * y normalizar sus avisos. Si uno falla, el resto sigue (lo maneja sync.ts).
 *
 * Las funciones normalize* son puras (se testean con fixtures); las fetch* hacen red.
 */

export type Board = {
  sourceId: "greenhouse" | "lever" | "ashby" | "remotive" | "jobicy" | "getonbrd" | "teamtailor" | "smartrecruiters" | "recruitee" | "workday" | "eightfold" | "successfactors" | "breezy" | "bamboohr";
  boardId: string; // "greenhouse:clara", "remotive"…
  slug?: string;
  region?: "us" | "eu";
  company?: string; // nombre para mostrar (directorio)
};

export type BoardFetch = { postings: NormalizedPosting[]; complete: boolean; received: number };

const DESC_MAX = 6000;

/* ---------- helpers ---------- */

const COUNTRY_ISO: Record<string, string> = {
  argentina: "AR",
  chile: "CL",
  uruguay: "UY",
  paraguay: "PY",
  bolivia: "BO",
  peru: "PE",
  colombia: "CO",
  ecuador: "EC",
  venezuela: "VE",
  mexico: "MX",
  brazil: "BR",
  brasil: "BR",
  "costa rica": "CR",
  panama: "PA",
  guatemala: "GT",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "estados unidos": "US",
  canada: "CA",
  spain: "ES",
  espana: "ES",
  "united kingdom": "GB",
  portugal: "PT",
  germany: "DE",
  france: "FR",
  italy: "IT",
  netherlands: "NL",
  ireland: "IE",
  poland: "PL",
  india: "IN",
  philippines: "PH",
};

export function countryIso(name: string | null | undefined): string | null {
  if (!name) return null;
  const t = name.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return COUNTRY_ISO[fold(t)] ?? null;
}

export function workplaceFromText(text: string): Workplace {
  const t = fold(text);
  if (/\b(hybrid|hibrido|híbrido)\b/.test(t)) return "hibrido";
  if (/\b(remote|remoto|teletrabajo|work from home|home office|anywhere)\b/.test(t)) return "remoto";
  if (/\b(on-?site|onsite|in office|presencial|in-person)\b/.test(t)) return "presencial";
  return "desconocido";
}

/**
 * Modalidad declarada en la descripción ("Modalidad: presencial", "esquema híbrido", "100% remoto").
 * Sólo frases explícitas: una mención suelta de "home office" como beneficio no alcanza para decir remoto.
 */
export function workplaceFromDescription(text: string): { value: Workplace; evidence: string } | null {
  const t = fold(text.slice(0, 6000));
  // Días repartidos entre oficina y casa ("3 días presenciales y 2 home office", "2 days per week on-site").
  const split = t.match(/\b\d\s*(\/\s*\d\s*)?(dias?|days?)\s*((per|a la|por) (week|semana)\s*)?(de\s*)?(presencial(es)?|en (la )?oficina|on-?site|in (the )?office|home office|remot[oa]s?)\b/);
  const declared = t.match(/\b(modalidad|esquema|modelo|formato|lugar de trabajo|work ?(?:mode|model|arrangement))(?: de (?:trabajo|contratacion|empleo))?\s*(?:(?:full|part)[ -]?time\s*)?(?:100\s*)?(presencial|hibrid[oa]|remot[oa]|home office|on-?site|hybrid|remote)\b/);
  // "5 días presenciales" es presencial; sólo un reparto parcial de la semana indica híbrido.
  const fullWeek = !!split && Number(split[0].match(/\d/)![0]) >= 5 && !split[1];
  // "in-office presence four days per week": días de oficina de una semana parcial → híbrido.
  const officeDays = t.match(/\bin-?office presence (one|two|three|four|[1-4]) days?\b/);
  const hit =
    (officeDays ? `hibrido: ${officeDays[0]}` : null) ??
    (split
      ? fullWeek
        ? split[0]
        : `hibrido: ${split[0]}`
      : (declared?.[2] ??
        t.match(
          /\b(100\s*(por ciento)?\s*(remot[oa]|home office|remote|presencial)|full ?remot[oa]|full ?remote|fully remote|trabajo remoto|teletrabajo|(de manera|en forma|de forma|de tipo) (presencial|remota|hibrida)|esquema hibrido|hybrid (role|position|work(ing)?( model)?|schedule)|(position|role) (will be|is) (categorized as )?(hybrid|remote|on-?site)|remote (full[ -]?time )?(position|role|job|work environment)|(based|work) remotely (from|in)|(full[ -]?time|jornada|empleo|trabajo|puesto) presencial|presencial (full[ -]?time|part[ -]?time|jornada)|on-?site (role|position))\b/,
        )?.[0] ??
        t.match(/#li-(remote|hybrid|onsite)\b/)?.[0]));
  if (!hit) return null;
  const value: Workplace = /hibrid|hybrid/.test(hit) ? "hibrido" : /remot|teletrabajo|home office/.test(hit) ? "remoto" : "presencial";
  return { value, evidence: (officeDays?.[0] ?? split?.[0] ?? declared?.[0] ?? hit).slice(0, 80) };
}

function wp(value: Workplace, from: Field<Workplace>["from"], evidence?: string): Field<Workplace> {
  return evidence ? { value, from, evidence } : { value, from };
}

function iso(d: unknown): string | null {
  if (d === null || d === undefined || d === "") return null;
  const n = typeof d === "number" ? (d < 1e12 ? d * 1000 : d) : Date.parse(String(d));
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}

function salary(min: unknown, max: unknown, currency: unknown, period: Salary["period"], text?: string): Field<Salary> | null {
  const lo = typeof min === "number" && min > 0 ? min : null;
  const hi = typeof max === "number" && max > 0 ? max : null;
  if (lo === null && hi === null && !text) return null;
  return { value: { min: lo, max: hi, currency: typeof currency === "string" ? currency.toUpperCase() : "", period, ...(text ? { text } : {}) }, from: "fuente" };
}

function periodFrom(raw: string | undefined | null): Salary["period"] {
  const t = fold(raw ?? "");
  if (/hour|hora/.test(t)) return "hora";
  if (/month|mes/.test(t)) return "mes";
  if (/year|annual|anual|ano/.test(t)) return "anio";
  return "desconocido";
}

const SLUG_RE = /^[A-Za-z0-9._%&~ -]{1,120}$/;
function assertSlug(slug: string | undefined): string {
  if (!slug || !SLUG_RE.test(slug)) throw new Error(`Slug inválido: ${slug}`);
  return encodeURIComponent(slug);
}

/* ---------- Greenhouse ---------- */

type GhJob = {
  id: number;
  internal_job_id?: number;
  requisition_id?: string | null;
  title: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
  location?: { name?: string };
  absolute_url: string;
  language?: string;
  content?: string;
  departments?: { name?: string }[];
  offices?: { name?: string; location?: string | null }[];
  metadata?: { name?: string; value?: unknown }[] | null;
};

export function normalizeGreenhouse(job: GhJob, board: Board): NormalizedPosting {
  const locName = job.location?.name ?? "";
  const offices = (job.offices ?? []).map((o) => [o.name, o.location].filter(Boolean).join(" · ")).filter(Boolean);
  const metaWorkplace = (job.metadata ?? []).find((m) => /workplace|remote|location type|modalidad/i.test(m.name ?? ""))?.value;
  const metaText = Array.isArray(metaWorkplace) ? metaWorkplace.join(" ") : typeof metaWorkplace === "string" ? metaWorkplace : "";
  const fromMeta = metaText ? workplaceFromText(metaText) : "desconocido";
  const fromLoc = workplaceFromText(locName);
  const workplace = fromMeta !== "desconocido" ? wp(fromMeta, "fuente", metaText) : fromLoc !== "desconocido" ? wp(fromLoc, "fuente", locName) : wp("desconocido", "fuente");
  const text = htmlToText(job.content, DESC_MAX);
  return {
    sourceId: "greenhouse",
    boardId: board.boardId,
    externalId: String(job.id),
    title: job.title.trim(),
    company: job.company_name?.trim() || board.company || board.slug || "",
    companySlug: board.slug,
    sourceUrl: job.absolute_url,
    applyUrl: job.absolute_url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200 && !text.endsWith("…"),
    locations: [locName].filter(Boolean),
    countries: [],
    regionText: offices.filter((o) => o !== locName),
    workplace,
    remoteFlag: workplace.value === "remoto" ? true : null,
    employmentType: null,
    department: job.departments?.[0]?.name,
    salary: null,
    publishedAt: iso(job.first_published),
    updatedAt: iso(job.updated_at),
    expiresAt: null,
    sourceLanguage: job.language,
  };
}

export async function fetchGreenhouse(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const host = board.region === "eu" ? "boards-api.eu.greenhouse.io" : "boards-api.greenhouse.io";
  const data = await fetchJson<{ jobs?: GhJob[] }>(`https://${host}/v1/boards/${assertSlug(board.slug)}/jobs?content=true`, opts);
  if (!Array.isArray(data.jobs)) throw new Error("Respuesta de Greenhouse sin 'jobs'");
  return { postings: data.jobs.map((j) => normalizeGreenhouse(j, board)), complete: true, received: data.jobs.length };
}

/* ---------- Lever ---------- */

type LeverPosting = {
  id: string;
  text: string;
  categories?: { location?: string; commitment?: string; team?: string; department?: string; allLocations?: string[] };
  country?: string | null;
  workplaceType?: string;
  salaryRange?: { currency?: string; interval?: string; min?: number; max?: number } | null;
  salaryDescriptionPlain?: string;
  descriptionPlain?: string;
  description?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
};

export function normalizeLever(p: LeverPosting, board: Board): NormalizedPosting {
  const cat = p.categories ?? {};
  const locs = [...new Set([cat.location, ...(cat.allLocations ?? [])].filter(Boolean) as string[])];
  const lists = (p.lists ?? []).map((l) => `${l.text ?? ""}\n${htmlToText(l.content, 3000)}`).join("\n\n");
  const text = [p.descriptionPlain?.trim() || htmlToText(p.description, 3000), lists, p.additionalPlain?.trim()].filter(Boolean).join("\n\n").slice(0, DESC_MAX);
  const wt = (p.workplaceType ?? "").toLowerCase();
  const workplace =
    wt === "remote" ? wp("remoto", "fuente", "workplaceType: remote") : wt === "hybrid" ? wp("hibrido", "fuente", "workplaceType: hybrid") : wt === "on-site" ? wp("presencial", "fuente", "workplaceType: on-site") : wp(workplaceFromText(locs.join(" ")), "fuente");
  const sr = p.salaryRange;
  return {
    sourceId: "lever",
    boardId: board.boardId,
    externalId: p.id,
    title: p.text.trim(),
    company: board.company || board.slug || "",
    companySlug: board.slug,
    sourceUrl: p.hostedUrl,
    applyUrl: p.applyUrl || p.hostedUrl,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: locs,
    countries: p.country ? [p.country.toUpperCase()] : [],
    regionText: [],
    workplace,
    remoteFlag: wt === "remote" ? true : wt === "on-site" ? false : null,
    employmentType: null,
    department: cat.department || cat.team,
    salary: sr ? salary(sr.min, sr.max, sr.currency, periodFrom(sr.interval), p.salaryDescriptionPlain?.trim() || undefined) : p.salaryDescriptionPlain?.trim() ? salary(null, null, "", "desconocido", p.salaryDescriptionPlain.trim()) : null,
    publishedAt: iso(p.createdAt),
    updatedAt: null,
    expiresAt: null,
    // la "commitment" de Lever es el tipo de jornada/contrato que publica el empleador
    ...(cat.commitment ? { employmentHint: cat.commitment } : {}),
  };
}

export async function fetchLever(board: Board, opts?: RetryOptions & { pageSize?: number; maxPages?: number }): Promise<BoardFetch> {
  const host = board.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 20;
  const out: NormalizedPosting[] = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await fetchJson<LeverPosting[]>(`https://${host}/v0/postings/${assertSlug(board.slug)}?mode=json&skip=${page * pageSize}&limit=${pageSize}`, opts);
    if (!Array.isArray(data)) throw new Error("Respuesta de Lever inesperada");
    out.push(...data.map((p) => normalizeLever(p, board)));
    if (data.length < pageSize) return { postings: out, complete: true, received: out.length };
  }
  return { postings: out, complete: false, received: out.length };
}

/* ---------- Ashby ---------- */

type AshbyAddress = { postalAddress?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } };
type AshbyJob = {
  id?: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string; address?: AshbyAddress }[];
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  publishedAt?: string;
  employmentType?: string;
  address?: AshbyAddress;
  jobUrl: string;
  applyUrl?: string;
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: { compensationType?: string; interval?: string; currencyCode?: string; minValue?: number; maxValue?: number }[];
  };
};

export function normalizeAshby(j: AshbyJob, board: Board): NormalizedPosting {
  const wt = (j.workplaceType ?? "").toLowerCase();
  const workplace = wt === "remote" ? wp("remoto", "fuente", "workplaceType: Remote") : wt === "hybrid" ? wp("hibrido", "fuente", "workplaceType: Hybrid") : wt === "onsite" ? wp("presencial", "fuente", "workplaceType: OnSite") : j.isRemote ? wp("remoto", "fuente", "isRemote") : wp(workplaceFromText(j.location ?? ""), "fuente");
  const locs = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean) as string[];
  // En avisos remotos, la dirección suele ser la sede de la empresa: no la usamos como país admitido.
  const countries =
    workplace.value === "remoto"
      ? []
      : ([j.address, ...(j.secondaryLocations ?? []).map((s) => s.address)].map((a) => countryIso(a?.postalAddress?.addressCountry)).filter(Boolean) as string[]);
  const sal = (j.compensation?.summaryComponents ?? []).find((c) => /salary/i.test(c.compensationType ?? ""));
  const text = j.descriptionPlain?.trim() ? j.descriptionPlain.trim().slice(0, DESC_MAX) : htmlToText(j.descriptionHtml, DESC_MAX);
  const id = j.id ?? j.jobUrl.match(/[0-9a-f-]{36}/i)?.[0] ?? j.jobUrl;
  return {
    sourceId: "ashby",
    boardId: board.boardId,
    externalId: id,
    title: j.title.trim(),
    company: board.company || board.slug || "",
    companySlug: board.slug,
    sourceUrl: j.jobUrl,
    applyUrl: j.applyUrl || j.jobUrl,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: [...new Set(locs)],
    countries: [...new Set(countries)],
    regionText: [],
    workplace,
    remoteFlag: typeof j.isRemote === "boolean" ? j.isRemote : null,
    employmentType: null,
    department: j.department || j.team,
    salary: sal ? salary(sal.minValue, sal.maxValue, sal.currencyCode, periodFrom(sal.interval), j.compensation?.compensationTierSummary) : null,
    publishedAt: iso(j.publishedAt),
    updatedAt: null,
    expiresAt: null,
    ...(j.employmentType ? { employmentHint: j.employmentType } : {}),
  };
}

export async function fetchAshby(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const data = await fetchJson<{ jobs?: AshbyJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${assertSlug(board.slug)}?includeCompensation=true`, opts);
  if (!Array.isArray(data.jobs)) throw new Error("Respuesta de Ashby sin 'jobs'");
  // isListed=false: el empleador no quiere que aparezca en listados.
  const listed = data.jobs.filter((j) => j.isListed !== false);
  return { postings: listed.map((j) => normalizeAshby(j, board)), complete: true, received: data.jobs.length };
}

/* ---------- Remotive ---------- */

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

export function normalizeRemotive(j: RemotiveJob, board: Board): NormalizedPosting {
  const region = (j.candidate_required_location ?? "").trim();
  const text = htmlToText(j.description, DESC_MAX);
  return {
    sourceId: "remotive",
    boardId: board.boardId,
    externalId: String(j.id),
    title: j.title.trim(),
    company: j.company_name.trim(),
    sourceUrl: j.url,
    applyUrl: j.url,
    linkRequired: true,
    attribution: "Publicado en Remotive",
    descriptionText: text,
    descriptionComplete: text.length > 200 && !text.endsWith("…"),
    locations: [],
    countries: [],
    regionText: region ? [region] : [],
    workplace: wp("remoto", "fuente", "Remotive sólo publica empleos remotos"),
    remoteFlag: true,
    employmentType: null,
    department: j.category,
    salary: j.salary?.trim() ? salary(null, null, "", "desconocido", j.salary.trim()) : null,
    publishedAt: iso(j.publication_date),
    updatedAt: null,
    expiresAt: null,
    ...(j.job_type ? { employmentHint: j.job_type } : {}),
  };
}

export async function fetchRemotive(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const data = await fetchJson<{ jobs?: RemotiveJob[] }>("https://remotive.com/api/remote-jobs", opts);
  if (!Array.isArray(data.jobs)) throw new Error("Respuesta de Remotive sin 'jobs'");
  return { postings: data.jobs.map((j) => normalizeRemotive(j, board)), complete: true, received: data.jobs.length };
}

/* ---------- Jobicy ---------- */

type JobicyJob = {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
};

export function normalizeJobicy(j: JobicyJob, board: Board): NormalizedPosting {
  const geo = (j.jobGeo ?? "").trim();
  // "Anywhere" es el valor por defecto cuando el aviso no informa región: no lo tomamos como worldwide.
  const region = geo && fold(geo) !== "anywhere" ? [geo] : [];
  const text = htmlToText(j.jobDescription || j.jobExcerpt, DESC_MAX);
  const level = j.jobLevel && fold(j.jobLevel) !== "any" ? j.jobLevel : "";
  return {
    sourceId: "jobicy",
    boardId: board.boardId,
    externalId: String(j.id),
    title: j.jobTitle.trim(),
    company: j.companyName.trim(),
    sourceUrl: j.url,
    applyUrl: j.url,
    linkRequired: true,
    attribution: "Publicado en Jobicy",
    descriptionText: text,
    descriptionComplete: !!j.jobDescription && text.length > 200,
    locations: [],
    countries: [],
    regionText: region,
    workplace: wp("remoto", "fuente", "Jobicy sólo publica empleos remotos"),
    remoteFlag: true,
    employmentType: null,
    department: j.jobIndustry?.[0],
    salary: salary(j.salaryMin, j.salaryMax, j.salaryCurrency, periodFrom(j.salaryPeriod)),
    publishedAt: iso(j.pubDate),
    updatedAt: null,
    expiresAt: null,
    ...(j.jobType?.length ? { employmentHint: j.jobType.join(" ") } : {}),
    ...(level ? { seniorityHint: level } : {}),
  };
}

export async function fetchJobicy(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const data = await fetchJson<{ jobs?: JobicyJob[] }>("https://jobicy.com/api/v2/remote-jobs?count=200", opts);
  if (!Array.isArray(data.jobs)) throw new Error("Respuesta de Jobicy sin 'jobs'");
  // Jobicy devuelve sólo los últimos avisos: el listado nunca es "completo".
  return { postings: data.jobs.map((j) => normalizeJobicy(j, board)), complete: false, received: data.jobs.length };
}

/* ---------- Get on Board ---------- */

type GobJob = {
  id: string;
  type?: string;
  attributes?: {
    title?: string;
    description?: string;
    projects?: string;
    functions?: string;
    desirable?: string;
    benefits?: string;
    remote?: boolean;
    remote_modality?: string;
    remote_zone?: string | null;
    countries?: string[];
    location_cities?: { data?: { attributes?: { name?: string } }[] } | string[];
    lang?: string;
    category_name?: string;
    min_salary?: number | null;
    max_salary?: number | null;
    published_at?: number;
    company?: { data?: { id?: string; attributes?: { name?: string } } };
    seniority?: { data?: { id?: number | string } };
    modality?: { data?: { id?: number | string } };
  };
  links?: { public_url?: string };
};

const GOB_SENIORITY: Record<string, string> = { "1": "trainee", "2": "junior", "3": "semi senior", "4": "senior", "5": "expert lead" };

export function normalizeGetonbrd(j: GobJob, board: Board): NormalizedPosting {
  const a = j.attributes ?? {};
  const modality = (a.remote_modality ?? "").toLowerCase();
  const workplace =
    modality === "fully_remote" || modality === "remote_local"
      ? wp("remoto", "fuente", `remote_modality: ${modality}`)
      : modality === "hybrid"
        ? wp("hibrido", "fuente", "remote_modality: hybrid")
        : modality === "no_remote"
          ? wp("presencial", "fuente", "remote_modality: no_remote")
          : a.remote
            ? wp("remoto", "fuente", "remote: true")
            : wp("desconocido", "fuente");
  const cities = Array.isArray(a.location_cities) ? (a.location_cities as string[]) : (a.location_cities?.data ?? []).map((c) => c.attributes?.name ?? "").filter(Boolean);
  const countryNames = a.countries ?? [];
  const countries = countryNames.map(countryIso).filter(Boolean) as string[];
  // "fully_remote" sin país = remoto global según Get on Board; lo dejamos por confirmar salvo zona explícita.
  const region = [a.remote_zone ?? ""].filter(Boolean);
  const text = [
    htmlToText(a.description, 2500),
    a.functions ? `Responsabilidades:\n${htmlToText(a.functions, 1800)}` : "",
    a.desirable ? `Deseable:\n${htmlToText(a.desirable, 1000)}` : "",
    a.benefits ? `Beneficios:\n${htmlToText(a.benefits, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, DESC_MAX);
  const url = j.links?.public_url ?? `https://www.getonbrd.com/jobs/${encodeURIComponent(j.id)}`;
  const sen = a.seniority?.data?.id !== undefined ? GOB_SENIORITY[String(a.seniority.data.id)] : undefined;
  return {
    sourceId: "getonbrd",
    boardId: board.boardId,
    externalId: j.id,
    title: (a.title ?? "").trim(),
    company: a.company?.data?.attributes?.name?.trim() || "",
    sourceUrl: url,
    applyUrl: url,
    linkRequired: true,
    attribution: "Publicado en Get on Board",
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: [...cities, ...countryNames],
    countries: modality === "fully_remote" && !countries.length ? [] : countries,
    regionText: region,
    workplace,
    remoteFlag: typeof a.remote === "boolean" ? a.remote : null,
    employmentType: null,
    department: a.category_name,
    salary:
      a.min_salary || a.max_salary
        ? salary(a.min_salary, a.max_salary, "", "desconocido", `Rango publicado en Get on Board: ${[a.min_salary, a.max_salary].filter(Boolean).join(" – ")}`)
        : null,
    publishedAt: iso(a.published_at),
    updatedAt: null,
    expiresAt: null,
    sourceLanguage: a.lang,
    ...(sen ? { seniorityHint: sen } : {}),
  };
}

export async function fetchGetonbrd(board: Board, opts?: RetryOptions & { perPage?: number; maxPagesPerCategory?: number; sleep?: (ms: number) => Promise<void> }): Promise<BoardFetch> {
  const base = "https://www.getonbrd.com/api/v0";
  const cats = await fetchJson<{ data?: { id: string }[] }>(`${base}/categories?per_page=100`, opts);
  if (!Array.isArray(cats.data)) throw new Error("Respuesta de Get on Board sin categorías");
  const perPage = opts?.perPage ?? 100;
  const maxPages = opts?.maxPagesPerCategory ?? 10;
  const pause = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const out = new Map<string, NormalizedPosting>();
  let complete = true;
  let received = 0;
  for (const cat of cats.data) {
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetchJson<{ data?: GobJob[]; meta?: { total_pages?: number } }>(
        `${base}/categories/${encodeURIComponent(cat.id)}/jobs?per_page=${perPage}&page=${page}&expand=${encodeURIComponent('["company"]')}`,
        opts,
      );
      if (!Array.isArray(res.data)) throw new Error("Respuesta de Get on Board inesperada");
      received += res.data.length;
      for (const j of res.data) if (j.attributes?.title) out.set(j.id, normalizeGetonbrd(j, board));
      const total = res.meta?.total_pages ?? (res.data.length < perPage ? page : page + 1);
      if (page >= total) break;
      if (page === maxPages) complete = false;
      await pause(1000);
    }
  }
  return { postings: [...out.values()], complete, received };
}

/* ---------- registro ---------- */

/* ---------- Teamtailor (feed RSS público del sitio de empleo) ---------- */

const TT_REMOTE: Record<string, Workplace> = { fully: "remoto", temporary: "remoto", hybrid: "hibrido", none: "presencial", onsite: "presencial" };
const TT_PAGE = 100;

/**
 * Teamtailor publica cada sitio de empleo como RSS: https://<sitio>/jobs.rss (offset/per_page, 100 por página).
 * Su documentación aclara que los datos del feed son públicos. Las etiquetas propias usan el prefijo tt:.
 */
/** Lector mínimo de XML para RSS (sin dependencias: los workflows corren sin npm install). */
const unCdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
function xmlTag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<(?:tt:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:tt:)?${name}>`, "i"));
  return m ? decodeEntities(unCdata(m[1])).trim() : "";
}
function xmlTags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<(?:tt:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:tt:)?${name}>`, "gi"))].map((m) => m[1]);
}

export function normalizeTeamtailor(xml: string, board: Board): { postings: NormalizedPosting[]; items: number } {
  const channel = xml.replace(/<item\b[\s\S]*?<\/item>/gi, "");
  const channelTitle = xmlTag(channel, "title");
  const company = board.company || channelTitle.replace(/\s*[-–|].*$/, "") || board.slug || "";
  const postings: NormalizedPosting[] = [];
  const items = xmlTags(xml, "item");
  for (const it of items) {
    const title = xmlTag(it, "title");
    const link = xmlTag(it, "link") || xmlTag(it, "guid");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const externalId = xmlTag(it, "guid") || link;
    // <tt:location> puede venir suelto o dentro de <tt:locations>.
    const locations = xmlTags(it, "location")
      .map((loc) => {
        const parts = ["city", "region", "country"].map((n) => xmlTag(loc, n));
        return parts.some(Boolean) ? parts.filter(Boolean).join(", ") : decodeEntities(unCdata(loc)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
    const remote = xmlTag(it, "remoteStatus").toLowerCase();
    const workplace = TT_REMOTE[remote] ? wp(TT_REMOTE[remote], "fuente", `remoteStatus: ${remote}`) : wp(workplaceFromText(locations.join(" ")), "fuente");
    const text = htmlToText(xmlTag(it, "description"), DESC_MAX);
    const countries = [...new Set(locations.map((l) => countryIso(l.split(",").pop())).filter((c): c is string => !!c))];
    postings.push({
      sourceId: "teamtailor",
      boardId: board.boardId,
      externalId: externalId.slice(0, 300),
      title,
      company,
      companySlug: board.slug,
      sourceUrl: link,
      applyUrl: link,
      linkRequired: false,
      descriptionText: text,
      descriptionComplete: text.length > 200 && !text.endsWith("…"),
      locations: [...new Set(locations)].slice(0, 6),
      countries,
      regionText: [],
      workplace,
      remoteFlag: TT_REMOTE[remote] ? TT_REMOTE[remote] === "remoto" : null,
      employmentType: null,
      department: xmlTag(it, "department") || undefined,
      salary: null,
      publishedAt: iso(xmlTag(it, "pubDate")),
      updatedAt: null,
      expiresAt: null,
    });
  }
  return { postings, items: items.length };
}

export async function fetchTeamtailor(board: Board, opts?: RetryOptions & { maxPages?: number }): Promise<BoardFetch> {
  const host = assertSlug(board.slug);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(decodeURIComponent(host))) throw new Error(`Sitio de Teamtailor inválido: ${board.slug}`);
  const maxPages = opts?.maxPages ?? 10;
  const postings: NormalizedPosting[] = [];
  let received = 0;
  for (let page = 0; page < maxPages; page++) {
    const xml = await fetchText(`https://${decodeURIComponent(host)}/jobs.rss?per_page=${TT_PAGE}&offset=${page * TT_PAGE}`, opts);
    const { postings: got, items } = normalizeTeamtailor(xml, board);
    postings.push(...got);
    received += items;
    // Página incompleta = última: recibimos el listado entero.
    if (items < TT_PAGE) return { postings, complete: true, received };
  }
  return { postings, complete: false, received };
}

/* ---------- SmartRecruiters (Posting API pública) ---------- */

type SrPosting = {
  id: string;
  name: string;
  refNumber?: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  company?: { name?: string; identifier?: string };
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string } | undefined> };
};
const SR_PAGE = 100;
const SR_MAX_DETAILS = 40;

export function normalizeSmartRecruiters(j: SrPosting, board: Board): NormalizedPosting {
  const loc = j.location ?? {};
  const where = loc.fullLocation || [loc.city, loc.region, loc.country?.toUpperCase()].filter(Boolean).join(", ");
  const workplace = loc.remote ? wp("remoto", "fuente", "location.remote") : loc.hybrid ? wp("hibrido", "fuente", "location.hybrid") : wp(workplaceFromText(where), "fuente");
  const sections = j.jobAd?.sections ?? {};
  const html = ["jobDescription", "qualifications", "additionalInformation"].map((k) => sections[k]?.text ?? "").join("\n");
  const text = htmlToText(html, DESC_MAX);
  const url = j.postingUrl || `https://jobs.smartrecruiters.com/${encodeURIComponent(board.slug ?? "")}/${encodeURIComponent(j.id)}`;
  const country = loc.country ? loc.country.toUpperCase() : null;
  return {
    sourceId: "smartrecruiters",
    boardId: board.boardId,
    externalId: j.id,
    title: j.name.trim(),
    company: board.company || j.company?.name || board.slug || "",
    companySlug: board.slug,
    sourceUrl: url,
    applyUrl: j.applyUrl || url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: where ? [where] : [],
    countries: country && workplace.value !== "remoto" ? [country] : [],
    regionText: [],
    workplace,
    remoteFlag: typeof loc.remote === "boolean" ? loc.remote : null,
    employmentType: null,
    department: j.department?.label || undefined,
    salary: null,
    publishedAt: iso(j.releasedDate),
    updatedAt: null,
    expiresAt: null,
    ...(j.typeOfEmployment?.label ? { employmentHint: j.typeOfEmployment.label } : {}),
    ...(j.experienceLevel?.label ? { seniorityHint: j.experienceLevel.label } : {}),
  };
}

/**
 * SmartRecruiters publica los avisos de cada empresa sin autenticación (Posting API). Las empresas grandes
 * tienen miles en el mundo: pedimos sólo los de Argentina y leemos el detalle (descripción) de cada uno.
 */
export async function fetchSmartRecruiters(board: Board, opts?: RetryOptions & { maxPages?: number }): Promise<BoardFetch> {
  const company = assertSlug(board.slug);
  const base = `https://api.smartrecruiters.com/v1/companies/${company}/postings`;
  const list: SrPosting[] = [];
  let complete = false;
  for (let page = 0; page < (opts?.maxPages ?? 5); page++) {
    const data = await fetchJson<{ content?: SrPosting[]; totalFound?: number }>(`${base}?country=ar&limit=${SR_PAGE}&offset=${page * SR_PAGE}`, opts);
    if (!Array.isArray(data.content)) throw new Error("Respuesta de SmartRecruiters sin 'content'");
    list.push(...data.content);
    if (data.content.length < SR_PAGE || list.length >= (data.totalFound ?? 0)) {
      complete = true;
      break;
    }
  }
  const postings: NormalizedPosting[] = [];
  for (const [i, j] of list.entries()) {
    // Sin el detalle no hay descripción: si hay demasiados, los últimos quedan sólo con el título.
    const full = i < SR_MAX_DETAILS ? await fetchJson<SrPosting>(`${base}/${encodeURIComponent(j.id)}`, opts).catch(() => j) : j;
    postings.push(normalizeSmartRecruiters({ ...j, ...full }, board));
  }
  return { postings, complete, received: list.length };
}

/* ---------- Recruitee (API pública del sitio de empleo) ---------- */

type RecruiteeOffer = {
  id: number;
  title: string;
  slug?: string;
  description?: string;
  requirements?: string;
  location?: string;
  city?: string;
  state_name?: string;
  country?: string;
  country_code?: string;
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  department?: string;
  employment_type_code?: string;
  careers_url?: string;
  careers_apply_url?: string;
  published_at?: string;
  created_at?: string;
};

export function normalizeRecruitee(o: RecruiteeOffer, board: Board): NormalizedPosting {
  const where = o.location || [o.city, o.state_name, o.country].filter(Boolean).join(", ");
  const workplace = o.remote ? wp("remoto", "fuente", "remote") : o.hybrid ? wp("hibrido", "fuente", "hybrid") : o.on_site ? wp("presencial", "fuente", "on_site") : wp(workplaceFromText(where), "fuente");
  const text = htmlToText(`${o.description ?? ""}\n${o.requirements ?? ""}`, DESC_MAX);
  const url = o.careers_url || `https://${board.slug}.recruitee.com/o/${o.slug ?? o.id}`;
  const country = o.country_code ? o.country_code.toUpperCase() : countryIso(o.country);
  return {
    sourceId: "recruitee",
    boardId: board.boardId,
    externalId: String(o.id),
    title: o.title.trim(),
    company: board.company || board.slug || "",
    companySlug: board.slug,
    sourceUrl: url,
    applyUrl: o.careers_apply_url || url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: where ? [where] : [],
    countries: country && workplace.value !== "remoto" ? [country] : [],
    regionText: [],
    workplace,
    remoteFlag: typeof o.remote === "boolean" ? o.remote : null,
    employmentType: null,
    department: o.department || undefined,
    salary: null,
    publishedAt: iso(o.published_at ?? o.created_at),
    updatedAt: null,
    expiresAt: null,
    ...(o.employment_type_code ? { employmentHint: o.employment_type_code.replace(/_/g, " ") } : {}),
  };
}

export async function fetchRecruitee(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const slug = assertSlug(board.slug);
  if (!/^[a-z0-9-]+$/i.test(slug)) throw new Error(`Cuenta de Recruitee inválida: ${board.slug}`);
  const data = await fetchJson<{ offers?: RecruiteeOffer[] }>(`https://${slug}.recruitee.com/api/offers/`, opts);
  if (!Array.isArray(data.offers)) throw new Error("Respuesta de Recruitee sin 'offers'");
  return { postings: data.offers.map((o) => normalizeRecruitee(o, board)), complete: true, received: data.offers.length };
}

/* ---------- Workday (búsqueda del sitio de empleo) ---------- */

type WdListItem = { title: string; externalPath: string; locationsText?: string; postedOn?: string; bulletFields?: string[] };
type WdDetail = {
  jobPostingInfo?: {
    id?: string;
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    startDate?: string;
    timeType?: string;
    jobReqId?: string;
    externalUrl?: string;
    remoteType?: string;
    country?: { descriptor?: string };
  };
  hiringOrganization?: { name?: string };
};
const WD_PAGE = 20;
const WD_MAX_DETAILS = 40;
const WD_SLUG = /^([a-z0-9-]+)\.(wd\d{1,3})\.([A-Za-z0-9_-]+)$/;

/** "pwc.wd3.Global_Experienced_Careers" → partes del sitio de empleo de Workday. */
export function workdaySite(slug: string | undefined): { tenant: string; wd: string; site: string } {
  const m = (slug ?? "").match(WD_SLUG);
  if (!m) throw new Error(`Sitio de Workday inválido: ${slug}`);
  return { tenant: m[1], wd: m[2], site: m[3] };
}

export function normalizeWorkday(item: WdListItem, detail: WdDetail | null, board: Board): NormalizedPosting {
  const { tenant, wd, site } = workdaySite(board.slug);
  const info = detail?.jobPostingInfo ?? {};
  const locs = [info.location || item.locationsText, ...(info.additionalLocations ?? [])].filter((l): l is string => !!l);
  const remote = (info.remoteType ?? "").toLowerCase();
  const workplace = /remote|remoto/.test(remote) ? wp("remoto", "fuente", `remoteType: ${info.remoteType}`) : /hybrid|h[ií]brido/.test(remote) ? wp("hibrido", "fuente", `remoteType: ${info.remoteType}`) : /on.?site|presencial/.test(remote) ? wp("presencial", "fuente", `remoteType: ${info.remoteType}`) : wp(workplaceFromText(locs.join(" ")), "fuente");
  const text = htmlToText(info.jobDescription, DESC_MAX);
  const url = info.externalUrl || `https://${tenant}.${wd}.myworkdayjobs.com/${site}${item.externalPath}`;
  const country = countryIso(info.country?.descriptor);
  return {
    sourceId: "workday",
    boardId: board.boardId,
    externalId: info.jobReqId || item.bulletFields?.[0] || item.externalPath,
    title: (info.title || item.title).trim(),
    company: board.company || detail?.hiringOrganization?.name || tenant,
    companySlug: board.slug,
    sourceUrl: url,
    applyUrl: url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: [...new Set(locs)].slice(0, 6),
    countries: country && workplace.value !== "remoto" ? [country] : [],
    regionText: [],
    workplace,
    remoteFlag: null,
    employmentType: null,
    salary: null,
    publishedAt: iso(info.startDate),
    updatedAt: null,
    expiresAt: null,
    ...(info.timeType ? { employmentHint: info.timeType } : {}),
  };
}

/**
 * Workday no tiene una API pública documentada: usamos la misma búsqueda JSON que usa el sitio de empleo
 * de cada empresa, con uso mínimo (sólo avisos de Argentina, de a 20, en serie, hasta 40 detalles).
 * La bolsa ES esa búsqueda: si se leyeron todas sus páginas, un aviso que ya no aparece se cierra como en cualquier ATS.
 */
export async function fetchWorkday(board: Board, opts?: RetryOptions & { maxPages?: number }): Promise<BoardFetch> {
  const { tenant, wd, site } = workdaySite(board.slug);
  const base = `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}`;
  const items: WdListItem[] = [];
  let complete = false;
  for (let page = 0; page < (opts?.maxPages ?? 5); page++) {
    const data = await postJson<{ total?: number; jobPostings?: WdListItem[] }>(`${base}/jobs`, { appliedFacets: {}, limit: WD_PAGE, offset: page * WD_PAGE, searchText: "Argentina" }, opts);
    if (!Array.isArray(data.jobPostings)) throw new Error("Respuesta de Workday sin 'jobPostings'");
    items.push(...data.jobPostings);
    if (data.jobPostings.length < WD_PAGE || items.length >= (data.total ?? 0)) {
      complete = true;
      break;
    }
  }
  const postings: NormalizedPosting[] = [];
  for (const [i, it] of items.entries()) {
    if (!it.externalPath?.startsWith("/")) continue;
    const detail = i < WD_MAX_DETAILS ? await fetchJson<WdDetail>(`${base}${it.externalPath}`, opts).catch(() => null) : null;
    postings.push(normalizeWorkday(it, detail, board));
  }
  return { postings, complete, received: items.length };
}

/* ---------- Eightfold (API del sitio de empleo) ---------- */

type EfPosition = {
  id: number | string;
  name: string;
  location?: string;
  locations?: string[];
  department?: string;
  t_create?: number;
  canonicalPositionUrl?: string;
  work_location_option?: string;
  job_description?: string;
};
const EF_PAGE = 20;
const EF_MAX_DETAILS = 40;

/** "mercadolibre.eightfold.ai" → dominio de la empresa que pide la API ("mercadolibre.com"). */
export function eightfoldDomain(host: string): string {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) throw new Error(`Sitio de Eightfold inválido: ${host}`);
  const sub = host.match(/^([a-z0-9-]+)\.eightfold\.ai$/i);
  return sub ? `${sub[1]}.com` : host.split(".").slice(-2).join(".");
}

export function normalizeEightfold(j: EfPosition, board: Board): NormalizedPosting {
  const host = board.slug ?? "";
  const locs = [...new Set([...(j.locations ?? []), j.location].filter((l): l is string => !!l))];
  const opt = (j.work_location_option ?? "").toLowerCase();
  const workplace = opt.includes("remote") ? wp("remoto", "fuente", `work_location_option: ${opt}`) : opt.includes("hybrid") ? wp("hibrido", "fuente", `work_location_option: ${opt}`) : opt.includes("onsite") || opt.includes("on-site") ? wp("presencial", "fuente", `work_location_option: ${opt}`) : wp(workplaceFromText(locs.join(" ")), "fuente");
  const text = htmlToText(j.job_description, DESC_MAX);
  const url = j.canonicalPositionUrl || `https://${host}/careers/job/${j.id}`;
  const countries = [...new Set(locs.map((l) => countryIso(l.split(",").pop())).filter((c): c is string => !!c))];
  return {
    sourceId: "eightfold",
    boardId: board.boardId,
    externalId: String(j.id),
    title: j.name.trim(),
    company: board.company || host,
    companySlug: board.slug,
    sourceUrl: url,
    applyUrl: url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: locs.slice(0, 6),
    countries: workplace.value === "remoto" ? [] : countries,
    regionText: [],
    workplace,
    remoteFlag: null,
    employmentType: null,
    department: j.department || undefined,
    salary: null,
    publishedAt: typeof j.t_create === "number" ? new Date(j.t_create * 1000).toISOString() : null,
    updatedAt: null,
    expiresAt: null,
  };
}

/** Eightfold arma cada sitio de empleo con una API JSON sin autenticación: pedimos sólo Argentina, de a 20, en serie. */
export async function fetchEightfold(board: Board, opts?: RetryOptions & { maxPages?: number }): Promise<BoardFetch> {
  const host = decodeURIComponent(assertSlug(board.slug));
  const domain = eightfoldDomain(host);
  const base = `https://${host}/api/apply/v2/jobs`;
  const list: EfPosition[] = [];
  let complete = false;
  for (let page = 0; page < (opts?.maxPages ?? 15); page++) {
    const data = await fetchJson<{ positions?: EfPosition[]; count?: number }>(`${base}?domain=${encodeURIComponent(domain)}&location=Argentina&start=${page * EF_PAGE}&num=${EF_PAGE}`, opts);
    if (!Array.isArray(data.positions)) throw new Error("Respuesta de Eightfold sin 'positions'");
    list.push(...data.positions);
    if (data.positions.length < EF_PAGE || list.length >= (data.count ?? 0)) {
      complete = true;
      break;
    }
  }
  const postings: NormalizedPosting[] = [];
  for (const [i, j] of list.entries()) {
    const full = i < EF_MAX_DETAILS && !j.job_description ? await fetchJson<EfPosition>(`${base}/${encodeURIComponent(String(j.id))}?domain=${encodeURIComponent(domain)}`, opts).catch(() => j) : j;
    postings.push(normalizeEightfold({ ...j, ...full }, board));
  }
  return { postings, complete, received: list.length };
}

/* ---------- SuccessFactors (sitio de empleo público, "Recruiting Marketing") ---------- */

const SF_PAGE = 25;
const SF_MAX_DETAILS = 40;

/** "careers.ey.com~ey" → host y prefijo del sitio (algunas empresas lo publican bajo una carpeta). */
export function successFactorsSite(slug: string | undefined): { host: string; prefix: string } {
  const [host, prefix] = (slug ?? "").split("~");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) || (prefix !== undefined && !/^[A-Za-z0-9_-]+$/.test(prefix))) throw new Error(`Sitio de SuccessFactors inválido: ${slug}`);
  return { host, prefix: prefix ? `/${prefix}` : "" };
}

const sfText = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Filas de la página de búsqueda (marcado estándar de los sitios de SuccessFactors: tr.data-row, a.jobTitle-link, span.jobLocation). */
export function parseSuccessFactorsSearch(html: string): { rows: { title: string; path: string; location: string }[]; total: number | null } {
  const rows: { title: string; path: string; location: string }[] = [];
  for (const tr of html.match(/<tr[^>]*class="[^"]*data-row[^"]*"[\s\S]*?<\/tr>/gi) ?? []) {
    const a = tr.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*>([\s\S]*?)<\/a>|<a[^>]*class="[^"]*jobTitle-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a) continue;
    const path = decodeEntities(a[1] ?? a[3]);
    const title = sfText(a[2] ?? a[4]);
    const loc = tr.match(/<span[^>]*class="[^"]*jobLocation[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (title && path.startsWith("/")) rows.push({ title, path, location: loc ? sfText(loc[1]) : "" });
  }
  const total = html.match(/paginationLabel[\s\S]*?<b>[^<]*<\/b>[\s\S]*?<b>\s*([\d.,]+)\s*<\/b>/i);
  return { rows: [...new Map(rows.map((r) => [r.path, r])).values()], total: total ? Number(total[1].replace(/[.,]/g, "")) : null };
}

export function normalizeSuccessFactors(row: { title: string; path: string; location: string }, detailHtml: string | null, board: Board): NormalizedPosting {
  const { host } = successFactorsSite(board.slug);
  const url = `https://${host}${row.path}`;
  // La descripción suele tener etiquetas anidadas: tomamos desde su apertura hasta el bloque de postulación o el pie.
  const open = detailHtml?.match(/<(?:span|div)[^>]*(?:itemprop="description"|class="[^"]*jobdescription[^"]*")[^>]*>/i);
  const rest = open && detailHtml ? detailHtml.slice((open.index ?? 0) + open[0].length, (open.index ?? 0) + open[0].length + 40_000) : "";
  const desc = rest.split(/<div[^>]*class="[^"]*(?:applylink|apply-button|social|share|jobfooter|job-footer)|<\/article>|<footer\b/i)[0];
  const text = htmlToText(desc, DESC_MAX);
  const posted = detailHtml?.match(/itemprop="datePosted"[^>]*content="([^"]+)"/i)?.[1];
  const location = row.location;
  const country = countryIso(location.split(",").pop()) ?? (/\b(AR|Argentina)\b/.test(location) ? "AR" : null);
  const workplace = wp(workplaceFromText(`${row.title} ${location}`), "fuente");
  const id = row.path.match(/\/(\d{6,})\/?$/)?.[1] ?? row.path;
  return {
    sourceId: "successfactors",
    boardId: board.boardId,
    externalId: id,
    title: row.title,
    company: board.company || host,
    companySlug: board.slug,
    sourceUrl: url,
    applyUrl: url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: location ? [location] : [],
    countries: country && workplace.value !== "remoto" ? [country] : [],
    regionText: [],
    workplace,
    remoteFlag: null,
    employmentType: null,
    salary: null,
    publishedAt: iso(posted),
    updatedAt: null,
    expiresAt: null,
  };
}

/**
 * Los sitios de empleo de SuccessFactors no tienen API pública: leemos la misma página de búsqueda que ve
 * cualquier persona, filtrada por Argentina, de a 25 y en serie, y el detalle de hasta 40 avisos.
 * Si la página no tiene el marcado esperado, falla (no se toma como "sin avisos", para no cerrar nada por error).
 */
export async function fetchSuccessFactors(board: Board, opts?: RetryOptions & { maxPages?: number }): Promise<BoardFetch> {
  const { host, prefix } = successFactorsSite(board.slug);
  const rows: { title: string; path: string; location: string }[] = [];
  let complete = false;
  for (let page = 0; page < (opts?.maxPages ?? 8); page++) {
    const html = await fetchText(`https://${host}${prefix}/search/?q=&locationsearch=Argentina&startrow=${page * SF_PAGE}`, opts);
    const { rows: got, total } = parseSuccessFactorsSearch(html);
    // Sin filas y sin el aviso explícito de "sin resultados": el formato cambió y no lo tomamos como bolsa vacía.
    if (!got.length && page === 0 && !/no ?results|no se encontraron|nenhum resultado|sin resultados/i.test(html)) throw new Error("La página de búsqueda de SuccessFactors no tiene el formato esperado");
    rows.push(...got);
    if (got.length < SF_PAGE || (total !== null && rows.length >= total)) {
      complete = true;
      break;
    }
  }
  const postings: NormalizedPosting[] = [];
  for (const [i, row] of rows.entries()) {
    const detail = i < SF_MAX_DETAILS ? await fetchText(`https://${host}${row.path}`, opts).catch(() => null) : null;
    postings.push(normalizeSuccessFactors(row, detail, board));
  }
  return { postings, complete, received: rows.length };
}

/* ---------- Breezy HR (JSON público del sitio de empleo) ---------- */

type BreezyLocation = { country?: { name?: string; id?: string }; city?: string; name?: string; is_remote?: boolean; remote_details?: { value?: string; label?: string } };
type BreezyPosition = {
  id: string;
  friendly_id?: string;
  name: string;
  url?: string;
  published_date?: string;
  type?: { id?: string; name?: string };
  location?: BreezyLocation;
  locations?: BreezyLocation[];
  department?: string | null;
  salary?: string;
  company?: { name?: string; logo_url?: string };
};
const BREEZY_MAX_DETAILS = 40;

/** La descripción está en el HTML del aviso, dentro de `job-description`; el resto de la página es la postulación. */
export function breezyDescription(html: string): string {
  const start = html.indexOf('class="job-description"');
  if (start === -1) return "";
  const ends = ["apply-button", "position-apply", "<footer", "</body>"].map((m) => html.indexOf(m, start)).filter((i) => i > start);
  return htmlToText(html.slice(start + 'class="job-description">'.length, ends.length ? Math.min(...ends) : undefined), DESC_MAX);
}

export function normalizeBreezy(j: BreezyPosition, board: Board, description = ""): NormalizedPosting {
  const locs = j.locations?.length ? j.locations : j.location ? [j.location] : [];
  const remote = locs.some((l) => l.is_remote);
  const detail = locs.map((l) => l.remote_details?.value ?? "").join(" ");
  const workplace = /hybrid/.test(detail) ? wp("hibrido", "fuente", `remote_details: ${detail.trim()}`) : remote ? wp("remoto", "fuente", `is_remote${detail.trim() ? ` (${detail.trim()})` : ""}`) : wp(workplaceFromText(j.name), "fuente");
  const countryNames = [...new Set(locs.map((l) => l.country?.name).filter((c): c is string => !!c))];
  const countries = [...new Set(locs.map((l) => countryIso(l.country?.id ?? l.country?.name)).filter((c): c is string => !!c))];
  const url = j.url || `https://${board.slug}.breezy.hr/p/${j.friendly_id ?? j.id}`;
  const logo = j.company?.logo_url?.startsWith("https://") ? encodeURI(j.company.logo_url) : undefined;
  return {
    sourceId: "breezy",
    boardId: board.boardId,
    externalId: j.id,
    title: j.name.trim(),
    company: board.company || j.company?.name || board.slug || "",
    companySlug: board.slug,
    ...(logo ? { companyLogo: logo } : {}),
    sourceUrl: url,
    applyUrl: `${url}/apply`,
    linkRequired: false,
    descriptionText: description,
    descriptionComplete: description.length > 200,
    locations: locs.map((l) => l.name ?? "").filter(Boolean),
    // "Totalmente remoto, dentro de las ubicaciones elegidas": el país es una condición, no una oficina.
    countries: workplace.value === "remoto" ? [] : countries,
    regionText: workplace.value === "remoto" ? countryNames : [],
    workplace,
    remoteFlag: locs.length ? remote : null,
    employmentType: null,
    department: j.department || undefined,
    salary: j.salary?.trim() ? salary(null, null, "", "desconocido", j.salary.trim()) : null,
    publishedAt: iso(j.published_date),
    updatedAt: null,
    expiresAt: null,
    ...(j.type?.name ? { employmentHint: j.type.name } : {}),
  };
}

export async function fetchBreezy(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const slug = assertSlug(board.slug);
  if (!/^[a-z0-9-]+$/i.test(slug)) throw new Error(`Cuenta de Breezy inválida: ${board.slug}`);
  const list = await fetchJson<BreezyPosition[]>(`https://${slug}.breezy.hr/json`, opts);
  if (!Array.isArray(list)) throw new Error("Respuesta de Breezy inesperada");
  const postings: NormalizedPosting[] = [];
  for (const [i, j] of list.entries()) {
    const url = j.url || `https://${slug}.breezy.hr/p/${j.friendly_id ?? j.id}`;
    // Sin el detalle no hay descripción: si hay demasiados, los últimos quedan sólo con el título.
    const description = i < BREEZY_MAX_DETAILS && url.startsWith(`https://${slug}.breezy.hr/`) ? await fetchText(url, opts).then(breezyDescription).catch(() => "") : "";
    postings.push(normalizeBreezy(j, board, description));
  }
  return { postings, complete: true, received: list.length };
}

/* ---------- BambooHR (API pública del sitio de empleo) ---------- */

type BambooLocation = { city?: string | null; state?: string | null; addressCountry?: string | null };
type BambooOpening = {
  id?: string;
  jobOpeningName: string;
  departmentLabel?: string | null;
  employmentStatusLabel?: string | null;
  location?: BambooLocation;
  locationType?: string | null;
  isRemote?: boolean | null;
  description?: string;
  datePosted?: string;
  jobOpeningShareUrl?: string;
  compensation?: string | null;
};
const BAMBOO_MAX_DETAILS = 40;
/** BambooHR codifica la modalidad: 0 presencial, 1 remoto, 2 híbrido. */
const BAMBOO_LOCATION_TYPE: Record<string, Workplace> = { "0": "presencial", "1": "remoto", "2": "hibrido" };

export function normalizeBamboo(o: BambooOpening, board: Board, id: string): NormalizedPosting {
  const loc = o.location ?? {};
  // A veces "state" trae el país ("Buenos Aires, Argentina") y "city" una lista de países ("Argentina, Uruguay").
  const parts = [...new Set([...(loc.city ?? "").split(","), loc.state ?? "", loc.addressCountry ?? ""].map((s) => s.trim()).filter((s) => s && s !== "."))];
  const typed = o.locationType ? BAMBOO_LOCATION_TYPE[o.locationType] : undefined;
  const workplace = typed ? wp(typed, "fuente", `locationType: ${o.locationType}`) : o.isRemote ? wp("remoto", "fuente", "isRemote") : wp(workplaceFromText(parts.join(" ")), "fuente");
  const countryParts = parts.filter((p) => countryIso(p) && !/^[A-Za-z]{2}$/.test(p));
  const countries = [...new Set(countryParts.map((p) => countryIso(p)!))];
  const text = htmlToText(o.description ?? "", DESC_MAX);
  const url = o.jobOpeningShareUrl?.replace(/\\\//g, "/") || `https://${board.slug}.bamboohr.com/careers/${id}`;
  return {
    sourceId: "bamboohr",
    boardId: board.boardId,
    externalId: id,
    title: o.jobOpeningName.trim(),
    company: board.company || board.slug || "",
    companySlug: board.slug,
    sourceUrl: url,
    applyUrl: url,
    linkRequired: false,
    descriptionText: text,
    descriptionComplete: text.length > 200,
    locations: parts.length ? [parts.join(", ")] : [],
    countries: workplace.value === "remoto" ? [] : countries,
    regionText: workplace.value === "remoto" ? countryParts : [],
    workplace,
    remoteFlag: workplace.value === "remoto" ? true : typed ? false : null,
    employmentType: null,
    department: o.departmentLabel || undefined,
    salary: o.compensation?.trim() ? salary(null, null, "", "desconocido", o.compensation.trim()) : null,
    publishedAt: iso(o.datePosted),
    updatedAt: null,
    expiresAt: null,
    ...(o.employmentStatusLabel ? { employmentHint: o.employmentStatusLabel } : {}),
  };
}

export async function fetchBamboo(board: Board, opts?: RetryOptions): Promise<BoardFetch> {
  const slug = assertSlug(board.slug);
  if (!/^[a-z0-9-]+$/i.test(slug)) throw new Error(`Cuenta de BambooHR inválida: ${board.slug}`);
  const base = `https://${slug}.bamboohr.com/careers`;
  const data = await fetchJson<{ result?: (BambooOpening & { id: string })[] }>(`${base}/list`, opts);
  if (!Array.isArray(data.result)) throw new Error("Respuesta de BambooHR sin 'result'");
  const postings: NormalizedPosting[] = [];
  for (const [i, o] of data.result.entries()) {
    const id = String(o.id);
    if (!/^\d+$/.test(id)) continue;
    const full = i < BAMBOO_MAX_DETAILS
      ? await fetchJson<{ result?: { jobOpening?: BambooOpening } }>(`${base}/${id}/detail`, opts).then((d) => d.result?.jobOpening).catch(() => undefined)
      : undefined;
    postings.push(normalizeBamboo({ ...o, ...full, location: full?.location ?? o.location }, board, id));
  }
  return { postings, complete: true, received: data.result.length };
}

export const FETCHERS: Record<Board["sourceId"], (b: Board, o?: RetryOptions) => Promise<BoardFetch>> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  remotive: fetchRemotive,
  jobicy: fetchJobicy,
  getonbrd: fetchGetonbrd,
  teamtailor: fetchTeamtailor,
  smartrecruiters: fetchSmartRecruiters,
  recruitee: fetchRecruitee,
  workday: fetchWorkday,
  eightfold: fetchEightfold,
  successfactors: fetchSuccessFactors,
  breezy: fetchBreezy,
  bamboohr: fetchBamboo,
};

/** Detecta ATS y slug a partir de la URL de una bolsa de empleo o de un aviso. */
export function parseBoardUrl(raw: string): { sourceId: "greenhouse" | "lever" | "ashby"; slug: string; region: "us" | "eu"; jobId?: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  let parts: string[];
  try {
    parts = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null; // %-escape inválido
  }
  if (/^(job-boards|boards)(\.eu)?\.greenhouse\.io$/.test(host) && parts[0]) {
    return { sourceId: "greenhouse", slug: parts[0], region: host.includes(".eu.") ? "eu" : "us", jobId: parts[1] === "jobs" ? parts[2] : undefined };
  }
  if (/^boards-api(\.eu)?\.greenhouse\.io$/.test(host) && parts[0] === "v1" && parts[1] === "boards" && parts[2]) {
    return { sourceId: "greenhouse", slug: parts[2], region: host.includes(".eu.") ? "eu" : "us" };
  }
  if (/^jobs(\.eu)?\.lever\.co$/.test(host) && parts[0]) {
    return { sourceId: "lever", slug: parts[0], region: host.includes(".eu.") ? "eu" : "us", jobId: parts[1] };
  }
  if (host === "jobs.ashbyhq.com" && parts[0]) {
    return { sourceId: "ashby", slug: parts[0], region: "us", jobId: parts[1] };
  }
  return null;
}

/** Lee UN aviso de un ATS admitido a partir de su URL (para búsquedas que agrega la persona). */
export async function fetchSingleJob(rawUrl: string, opts?: RetryOptions): Promise<NormalizedPosting | null> {
  const parsed = parseBoardUrl(rawUrl);
  if (!parsed?.jobId) return null;
  const board: Board = { sourceId: parsed.sourceId, boardId: `${parsed.sourceId}:${parsed.slug.toLowerCase()}`, slug: parsed.slug, region: parsed.region };
  const id = assertSlug(parsed.jobId);
  if (parsed.sourceId === "greenhouse") {
    const host = parsed.region === "eu" ? "boards-api.eu.greenhouse.io" : "boards-api.greenhouse.io";
    const job = await fetchJson<GhJob>(`https://${host}/v1/boards/${assertSlug(parsed.slug)}/jobs/${id}?content=true`, opts);
    return normalizeGreenhouse(job, board);
  }
  if (parsed.sourceId === "lever") {
    const host = parsed.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
    const p = await fetchJson<LeverPosting>(`https://${host}/v0/postings/${assertSlug(parsed.slug)}/${id}?mode=json`, opts);
    return normalizeLever(p, board);
  }
  const all = await fetchAshby(board, opts);
  return all.postings.find((p) => p.externalId === parsed.jobId || p.sourceUrl.includes(parsed.jobId!)) ?? null;
}
