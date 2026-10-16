import { fetchJson, type RetryOptions } from "./http";
import { fold, htmlToText } from "./text";
import type { Field, NormalizedPosting, Salary, Workplace } from "./types";

/**
 * Conectores independientes: cada uno sabe pedir el listado de UNA bolsa (empresa o portal)
 * y normalizar sus avisos. Si uno falla, el resto sigue (lo maneja sync.ts).
 *
 * Las funciones normalize* son puras (se testean con fixtures); las fetch* hacen red.
 */

export type Board = {
  sourceId: "greenhouse" | "lever" | "ashby" | "remotive" | "jobicy" | "getonbrd";
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

/** Sólo logos servidos por https (se muestran tal cual en la web). */
const logo = (u: string | undefined | null): { companyLogo?: string } => (typeof u === "string" && /^https:\/\/\S+$/.test(u.trim()) ? { companyLogo: u.trim() } : {});

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  company_logo?: string;
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
    ...logo(j.company_logo),
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
  companyLogo?: string;
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
    ...logo(j.companyLogo),
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
    company?: { data?: { id?: string; attributes?: { name?: string; logo?: string } } };
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
    ...logo(a.company?.data?.attributes?.logo),
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

export const FETCHERS: Record<Board["sourceId"], (b: Board, o?: RetryOptions) => Promise<BoardFetch>> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  remotive: fetchRemotive,
  jobicy: fetchJobicy,
  getonbrd: fetchGetonbrd,
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
