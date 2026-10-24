import type { NormalizedPosting, Workplace } from "./types";
import { htmlToText } from "./text";

export const APIFY_JOBS = {
  linkedin: { actor: "curious_coder/linkedin-jobs-scraper", name: "LinkedIn", fields: ["id", "title", "companyName", "link", "applyUrl", "location", "descriptionText", "postedAt", "salary", "seniorityLevel", "employmentType", "companyLogo"] },
  indeed: { actor: "curious_coder/indeed-scraper", name: "Indeed", fields: ["id", "title", "companyDetails.name", "viewJobLink", "originalApplyUrl", "formattedLocation", "location.countryCode", "jobDescription", "pubDate", "expirationDate", "expired", "salary", "jobTypes", "companyDetails.logoUrl", "companyLogoUrl"] },
  computrabajo: { actor: "shahidirfan/Computrabajo-Jobs-Scraper", name: "Computrabajo", fields: ["id", "title", "company", "url", "applyUrl", "location", "descriptionText", "postedDate", "updatedAt", "salary", "jobType", "companyLogo", "logo"] },
  // Bumeran Argentina. Nunca pedimos contactName, contactEmail, contactPhone, extractedEmails/Phones/Urls ni socialProfiles.
  bumeran: { actor: "blackfalcondata/bumeran-scraper", name: "Bumeran", fields: ["jobKey", "title", "company", "isConfidential", "canonicalUrl", "portalUrl", "location", "descriptionHtml", "description", "postedDate", "expiresDate", "sourceCountry", "sourceDomain", "salaryText", "salaryMin", "salaryMax", "salaryCurrency", "salaryType", "workModality", "employmentType", "contractType", "seniorityLevel", "jobArea", "companyLogo", "changeType"] },
} as const;
export type ApifyJobSource = keyof typeof APIFY_JOBS;

/**
 * Actors de LinkedIn intercambiables: traen el mismo aviso (id de LinkedIn), a distinto precio por fila
 * (plan gratis de Apify, 19/10/2026). El inicio se estima en US$0,02 para cubrir también el uso de plataforma.
 */
export const LINKEDIN_ACTORS = {
  curious: { actor: "curious_coder/linkedin-jobs-scraper", pricePerRow: 0.002 },
  valig: { actor: "valig/linkedin-jobs-scraper", pricePerRow: 0.0004 },
  cheap: { actor: "cheap_scraper/linkedin-job-scraper", pricePerRow: 0.0007 },
} as const;
export type LinkedinActor = keyof typeof LINKEDIN_ACTORS;
/** Campos posibles de los Actors alternativos: sólo datos del aviso, nunca de quien lo publicó. */
/** Fuente de un Actor conocido (`alt`: LinkedIn por un Actor que no es curious_coder), o null si no es nuestro. */
export function apifySourceOfActor(actor: string): { source: ApifyJobSource; alt: boolean } | null {
  if (Object.values(LINKEDIN_ACTORS).some((a) => a.actor === actor)) return { source: "linkedin", alt: actor !== LINKEDIN_ACTORS.curious.actor };
  const source = (Object.keys(APIFY_JOBS) as ApifyJobSource[]).find((s) => APIFY_JOBS[s].actor === actor);
  return source ? { source, alt: false } : null;
}
export const LINKEDIN_ALT_FIELDS = ["id", "jobId", "title", "jobTitle", "companyName", "company", "link", "url", "jobUrl", "applyUrl", "location", "descriptionHtml", "descriptionText", "description", "jobDescription", "postedAt", "publishedAt", "postedDate", "salary", "salaryInfo", "seniorityLevel", "experienceLevel", "employmentType", "contractType", "companyLogo", "companyLogoUrl"] as const;
/** Títulos que los Actors pueden descartar antes de cobrar la fila (el filtro fino es import-filter.ts). */
export const LINKEDIN_TITLE_EXCLUDE = ["chofer", "operario", "repartidor", "cadete", "cajero", "repositor", "mozo", "vigilador", "mostrador", "promotor", "telemarketer", "call center"];
/** Ubicaciones de LinkedIn que abarcan a la Argentina sin nombrarla: la elegibilidad decide con el texto del aviso. */
const LATAM_LOCATION = /\b(latin america|latam|latinoam[eé]rica|am[eé]rica latina|south america|sudam[eé]rica)\b/i;
export const linkedinJobId = (link: string) => /\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/.exec(link)?.[1] ?? "";
/** Id de Bumeran: el número al final del enlace (".../empleos/analista-contable-empresa-1118281573.html"). */
export const bumeranJobId = (link: string) => /^https?:\/\/(?:www\.)?bumeran\.com\.ar\/empleos\/(?:[^/?#]*-)?(\d{6,})\.html/.exec(link)?.[1] ?? "";
/** Modalidad que Bumeran informa en cada aviso ("Remoto", "Híbrido", "Presencial"). */
function bumeranWorkplace(value: string): Workplace {
  const v = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /remot/.test(v) ? "remoto" : /hibrid/.test(v) ? "hibrido" : /presencial/.test(v) ? "presencial" : "desconocido";
}
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function url(value: unknown, base?: string): string {
  try {
    if (!str(value)) return "";
    const u = new URL(str(value), base);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) return "";
    ["refId", "trackingId", "position", "pageNum", "utm_source", "utm_medium", "utm_campaign"].forEach((key) => u.searchParams.delete(key));
    return u.href;
  } catch { return ""; }
}
function date(value: unknown): string | null {
  if (typeof value === "number") {
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return value > 0 && Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const s = str(value);
  // No asignamos una zona horaria inventada a fechas locales de Computrabajo.
  const d = /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s.slice(0, 10)) : null;
  return d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Solo datos del aviso. Nunca importamos perfiles de reclutadores, fotos, edades ni contactos. */
export function normalizeApifyJobs(source: ApifyJobSource, rows: unknown[], now: string) {
  const postings: NormalizedPosting[] = [];
  const rejected: Record<string, number> = {};
  const seen = new Set<string>();
  const reject = (why: string) => { rejected[why] = (rejected[why] ?? 0) + 1; };
  for (const raw of rows) {
    const r = obj(raw);
    const rawId = source === "bumeran" ? "" : str(r.id) || (typeof r.id === "number" ? String(r.id) : "") || str(r.jobId) || (typeof r.jobId === "number" ? String(r.jobId) : "");
    const title = str(r.title) || str(r.jobTitle);
    const company = source === "linkedin" ? str(r.companyName) || str(r.company) || str(obj(r.company).name) : source === "indeed" ? str(r["companyDetails.name"]) || str(obj(r.companyDetails).name) : str(r.company);
    // El HTML conserva los párrafos y las listas: sin ellos no se separan requisitos de deseables
    // (valig trae "description" en texto plano pegado, sin saltos de línea).
    const description = htmlToText(str(r.descriptionHtml) || str(r.descriptionText) || str(r.jobDescription) || str(r.description), 100000);
    const sourceUrl = source === "linkedin" ? url(r.link) || url(r.jobUrl) || url(r.url) : source === "indeed" ? url(r.viewJobLink, "https://ar.indeed.com") : source === "bumeran" ? url(r.canonicalUrl) || url(r.portalUrl) : url(r.url);
    const applyUrl = source === "indeed" ? url(r.originalApplyUrl) || sourceUrl : url(r.applyUrl) || sourceUrl;
    // En LinkedIn el id sale del enlace: así coinciden los avisos que traen Actors distintos.
    // En Bumeran, el número del aviso (jobKey); "jobId" del Actor es un hash propio que no usamos.
    const bumeranKey = typeof r.jobKey === "number" ? String(r.jobKey) : str(r.jobKey);
    const id = source === "bumeran" ? (/^\d{6,}$/.test(bumeranKey) ? bumeranKey : bumeranJobId(sourceUrl)) : (source === "linkedin" && linkedinJobId(sourceUrl)) || rawId;
    const publishedAt = date(r.postedAt ?? r.pubDate ?? r.postedDate ?? r.publishedAt);
    const expiresAt = date(r.expirationDate ?? r.expiresDate);
    if (!id || !title || !company || !sourceUrl || !applyUrl) { reject("campos_obligatorios"); continue; }
    if (description.length < 300) { reject("descripcion_corta"); continue; }
    if (r.expired === true || r.changeType === "EXPIRED" || (expiresAt && expiresAt <= now) || (publishedAt && Date.parse(now) - Date.parse(publishedAt) > 30 * 86400000)) { reject("vencido_o_antiguo"); continue; }
    const country = str(r["location.countryCode"]) || str(obj(r.location).countryCode);
    if (source === "indeed" && country.toUpperCase() !== "AR") { reject("pais_no_confirmado"); continue; }
    // LinkedIn devuelve el país en cada ubicación; Computrabajo AR lo identifica por el host.
    const location = str(r.formattedLocation) || str(r.location);
    const latam = source === "linkedin" && !/argentina|buenos aires/i.test(location) && LATAM_LOCATION.test(location);
    if (source === "linkedin" && !/argentina|buenos aires/i.test(location) && !latam) { reject("pais_no_confirmado"); continue; }
    if (source === "computrabajo" && new URL(sourceUrl).hostname !== "ar.computrabajo.com") { reject("pais_no_confirmado"); continue; }
    // Bumeran: sólo el sitio argentino (el Actor también cubre Perú, México, Chile y otros).
    if (source === "bumeran" && (!/^(www\.)?bumeran\.com\.ar$/.test(new URL(sourceUrl).hostname) || (str(r.sourceCountry) && str(r.sourceCountry).toUpperCase() !== "AR"))) { reject("pais_no_confirmado"); continue; }
    if (seen.has(id)) { reject("duplicado"); continue; }
    seen.add(id);
    // No convertimos salario “a convenir”, números sospechosos o 0 en una promesa salarial.
    const salaryText = str(r.salary) || str(r.salaryInfo) || str(r.salaryText) || (Array.isArray(r.salaryInfo) ? r.salaryInfo.map(str).filter(Boolean).join(" - ") : "");
    // Bumeran puede traer el rango en números (salaryMin/salaryMax); se usan sólo si son positivos.
    const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    const [salaryMin, salaryMax] = source === "bumeran" ? [amount(r.salaryMin), amount(r.salaryMax)] : [null, null];
    const salary = /[1-9]\d/.test(salaryText) || salaryMin || salaryMax ? { value: { min: salaryMin, max: salaryMax, currency: str(r.salaryCurrency), period: "desconocido" as const, text: salaryText || [salaryMin, salaryMax].filter(Boolean).join(" - ") }, from: "fuente" as const } : null;
    const workplace = source === "bumeran" ? bumeranWorkplace(str(r.workModality)) : "desconocido";
    // Logo de la empresa si el Actor lo trae (sólo https; nunca fotos de personas).
    const logo = [r.companyLogo, r.companyLogoUrl, r.logo, r["companyDetails.logoUrl"], obj(r.companyDetails).logoUrl].map((v) => url(v)).find((u) => u.startsWith("https://"));
    postings.push({
      ...(logo ? { companyLogo: logo } : {}),
      sourceId: `apify-${source}`, boardId: `apify:${source}:ar`, externalId: id, title, company,
      sourceUrl, applyUrl, linkRequired: true, attribution: `Publicado en ${APIFY_JOBS[source].name} · vía Apify`,
      descriptionText: description.slice(0, 12000), descriptionComplete: description.length <= 12000,
      // "Latin America" no es un país: sin "AR" fijo, eligibility.ts mira la región y la descripción (p. ej. "US only").
      locations: location ? [location] : [], countries: latam ? [] : ["AR"], regionText: [],
      workplace: workplace === "desconocido" ? { value: workplace, from: "fuente" } : { value: workplace, from: "fuente", evidence: `Bumeran: ${str(r.workModality)}` },
      remoteFlag: workplace === "remoto" ? true : workplace === "presencial" ? false : null,
      ...(source === "bumeran" && str(r.jobArea) ? { department: str(r.jobArea) } : {}),
      // LinkedIn (valig) informa la función del puesto ("Sales", "Information Technology"). Sólo si es una:
      // "Engineering, Finance, and Research" mezcla áreas y confundiría la clasificación.
      employmentType: null, salary, publishedAt, updatedAt: date(r.updatedAt), expiresAt,
      employmentHint: source === "bumeran" ? [str(r.employmentType), str(r.contractType)].filter(Boolean).join(", ") : str(r.employmentType) || str(r.contractType) || str(r.jobType) || (Array.isArray(r.jobTypes) ? r.jobTypes.map(str).filter(Boolean).join(", ") : ""),
      seniorityHint: str(r.seniorityLevel) || str(r.experienceLevel),
    });
  }
  return { postings, rejected, received: rows.length, accepted: postings.length };
}

/**
 * Opciones de valig: `remote` agrega el filtro de LinkedIn «Remoto» (f_WT=2) y `skipJobIds` le pasa los avisos
 * de LinkedIn que ya tenemos para que no los devuelva (no se pagan filas repetidas).
 */
export type LinkedinSearchExtras = { remote?: boolean; skipJobIds?: string[] };

/** Clave del modo incremental de Bumeran: una por palabra, estable aunque cambien las filas pedidas. */
export const bumeranStateKey = (keyword: string) => `maru-ar-${keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/**
 * Ciudades para LinkedIn (sólo valig/cheap): cada búsqueda trae como mucho 100 avisos de todo el país, así que las
 * mismas palabras por ciudad encuentran otros (24/10). Se cuentan como búsquedas distintas en el ledger.
 */
export const LINKEDIN_CITIES: Record<string, string> = {
  caba: "Ciudad Autónoma de Buenos Aires, Argentina",
  cordoba: "Córdoba, Argentina",
  rosario: "Rosario, Santa Fe, Argentina",
  mendoza: "Mendoza, Argentina",
  la_plata: "La Plata, Buenos Aires, Argentina",
  mar_del_plata: "Mar del Plata, Buenos Aires, Argentina",
  tucuman: "San Miguel de Tucumán, Tucumán, Argentina",
  neuquen: "Neuquén, Argentina",
  santa_fe: "Santa Fe, Argentina",
  salta: "Salta, Argentina",
};

export function apifyJobInput(source: ApifyJobSource, keyword: string, limit: number, maxLimit = 50, actor: LinkedinActor = "curious", window: "week" | "month" = "week", location = "Argentina", extras: LinkedinSearchExtras = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) throw new Error(`Se admiten entre 1 y ${maxLimit} avisos por fuente.`);
  if ((extras.remote || extras.skipJobIds?.length) && !(source === "linkedin" && actor === "valig")) throw new Error("El filtro remoto y la lista de avisos a saltear sólo existen en LinkedIn con --actor=valig.");
  // Antigüedad máxima del aviso en los Actors alternativos: una semana (default) o un mes.
  const age = window === "month" ? "r2592000" : "r604800";
  if (source === "linkedin" && actor === "valig") {
    return {
      keywords: keyword, location, datePosted: age, limit, titleExclude: LINKEDIN_TITLE_EXCLUDE,
      ...(extras.remote ? { urlParam: [{ key: "f_WT", value: "2" }] } : {}),
      ...(extras.skipJobIds?.length ? { skipJobId: extras.skipJobIds } : {}),
    };
  }
  if (source === "linkedin" && actor === "cheap") return { keyword: [keyword], location, publishedAt: age, maxItems: limit, saveOnlyUniqueItems: true, enrichCompanyData: false, jobTitleExclude: LINKEDIN_TITLE_EXCLUDE };
  if (source === "linkedin") return { keywords: keyword, location: "Argentina", datePosted: "pastWeek", scrapeCompany: false, limitPerSource: limit, splitByLocation: false };
  if (source === "indeed") return { country: "ar", query: keyword, location: "Argentina", postedWithinDays: "7", count: limit };
  if (source === "bumeran") {
    // El Actor no filtra por fecha: se piden los más recientes primero y normalizeApifyJobs descarta los de más de 30 días.
    // Modo incremental con una clave por búsqueda: al repetirla sólo devuelve (y cobra) avisos nuevos o cambiados.
    if (location !== "Argentina") throw new Error("Bumeran sólo se busca en Argentina.");
    return {
      query: keyword, country: "AR", sort: "RECIENTES", maxResults: limit,
      includeDetails: true, descriptionFormat: "html", descriptionMaxLength: 0, compact: false,
      incrementalMode: true, stateKey: bumeranStateKey(keyword), emitUnchanged: false, emitExpired: false,
    };
  }
  return { keyword, countryCode: "ar", maxJobs: limit, proxyConfiguration: { useApifyProxy: false } };
}

/**
 * Precio estimado por fila entregada (US$, docs/PROVEEDORES-AVISOS.md) y por inicio de Actor.
 * Se usa para frenar ANTES de pasarse del presupuesto: el costo real se registra después en el ledger.
 */
export const APIFY_PRICE_PER_ROW: Record<ApifyJobSource, number> = { linkedin: 0.002, indeed: 0.0001, computrabajo: 0.0015, bumeran: 0.001 };
export const APIFY_START_USD = 0.02;

/**
 * Palabras clave para importar: sólo áreas profesionales (decisión del dueño, 19/10/2026; ver import-filter.ts).
 * LinkedIn es la fuente que trae ese perfil; Computrabajo e Indeed traían sobre todo oficios o poco volumen.
 */
export const APIFY_KEYWORDS: Record<ApifyJobSource, string[]> = {
  linkedin: [
    // Tecnología y datos
    "desarrollador backend", "desarrollador frontend", "full stack developer", "software engineer", "qa automation",
    "devops engineer", "cloud engineer", "mobile developer", "ciberseguridad", "analista funcional", "consultor sap",
    "data engineer", "data analyst", "data scientist", "business intelligence", "machine learning",
    // Producto y diseño
    "product manager", "product owner", "ux ui designer", "product designer", "diseñador gráfico",
    // Marketing
    "performance marketing", "marketing digital", "seo", "growth marketing", "content marketing", "brand manager",
    "trade marketing", "community manager", "crm marketing",
    // Finanzas
    "analista financiero", "fp&a", "controller", "tesorería", "auditoría", "analista de impuestos", "analista contable",
    "contador", "riesgo crediticio", "analista de inversiones",
    // Ventas B2B y clientes
    "account executive", "business development", "key account manager", "customer success manager", "sales development representative",
    // RRHH, legal, operaciones y consultoría
    "talent acquisition", "hr business partner", "analista de recursos humanos", "compensaciones y beneficios",
    "abogado", "compliance", "project manager", "business analyst", "analista de procesos", "pmo", "consultor de negocios",
  ],
  computrabajo: ["analista contable", "analista financiero", "desarrollador", "analista de recursos humanos", "marketing digital", "analista de datos"],
  indeed: ["desarrollador", "data analyst", "analista financiero", "marketing", "analista contable", "product manager"],
  // Bumeran exige que el aviso tenga todas las palabras: búsquedas cortas, en español y generalistas.
  bumeran: [
    // Administración, contabilidad y finanzas
    "analista administrativo", "analista contable", "contador", "analista de cuentas a pagar", "analista de impuestos",
    "analista financiero", "tesorería", "auditor", "controller", "analista de costos", "analista de créditos",
    // RR. HH. y legal
    "analista de recursos humanos", "selección", "liquidación de sueldos", "capacitación", "abogado", "legales",
    // Ventas B2B y marketing
    "ejecutivo de cuentas", "key account", "desarrollo de negocios", "ejecutivo comercial", "marketing", "marketing digital",
    "comunicación", "trade marketing",
    // Operaciones, compras y comercio exterior
    "analista de compras", "comprador", "comercio exterior", "supply chain", "planeamiento", "analista de procesos", "project manager",
    // Datos y tecnología
    "analista de datos", "business intelligence", "desarrollador", "analista funcional", "analista de sistemas", "analista de soporte",
    // Atención al cliente (de analista para arriba) y programas de ingreso
    "analista de atención al cliente", "customer success", "jóvenes profesionales", "trainee",
  ],
};

const rowPrice = (source: ApifyJobSource, actor: LinkedinActor) => (source === "linkedin" ? LINKEDIN_ACTORS[actor].pricePerRow : APIFY_PRICE_PER_ROW[source]);

/** Peor caso de una corrida: inicio + todas las filas pedidas. */
export const apifyRunCeiling = (source: ApifyJobSource, rows: number, actor: LinkedinActor = "curious") => APIFY_START_USD + rows * rowPrice(source, actor);

/** Tope de la próxima corrida dentro del presupuesto acumulado; 0 = no correr. */
export function apifyNextCap(source: ApifyJobSource, rows: number, spentUsd: number, budgetUsd: number, actor: LinkedinActor = "curious"): number {
  const ceiling = apifyRunCeiling(source, rows, actor);
  return spentUsd + ceiling <= budgetUsd + 1e-9 ? Math.round(ceiling * 1000) / 1000 : 0;
}

/** Ids de LinkedIn que ya están en el inventario, vengan de Apify o de otra fuente con enlace a LinkedIn (Fantastic). */
export function knownLinkedinIds(postings: { sourceId: string; externalId: string; sourceUrl: string; applyUrl: string }[]): string[] {
  const ids = new Set<string>();
  for (const p of postings) {
    const id = p.sourceId === "apify-linkedin" ? p.externalId : linkedinJobId(p.sourceUrl) || linkedinJobId(p.applyUrl);
    if (/^\d{6,}$/.test(id)) ids.add(id);
  }
  return [...ids].sort();
}

/** Lo mínimo del ledger que hace falta para no repetir búsquedas (providers.ts LedgerEntry). */
type SearchLog = { at: string; provider: string; call: string; params: Record<string, string>; rows: number; created?: number };
/** Una búsqueda que trajo menos de esta proporción de avisos nuevos no se repite en el mes. */
export const MIN_NEW_SHARE = 0.3;
const searchId = (actor: string, keyword: string, location: string, remote: boolean) => [actor, keyword.trim().toLowerCase(), location.toLowerCase(), remote ? "remoto" : ""].join("|");

/**
 * Motivo para no pagar otra vez una búsqueda (mismo Actor, palabra, ubicación y filtro remoto), o null:
 * - se corrió hace menos de 7 días: traería casi lo mismo;
 * - en los últimos 30 días trajo menos de MIN_NEW_SHARE de avisos nuevos: está agotada.
 * Las corridas viejas no guardaban ubicación: se toman como Argentina.
 */
export function apifyRepeatReason(entries: SearchLog[], actor: string, keyword: string, location: string, remote: boolean, now: string): string | null {
  const id = searchId(actor, keyword, location, remote);
  const past = entries.filter((e) => e.provider === "apify" && e.call === "run" && e.rows > 0 && e.params.actor && searchId(e.params.actor, e.params.keyword ?? "", e.params.location ?? "Argentina", e.params.remote === "1") === id);
  const days = (at: string) => (Date.parse(now) - Date.parse(at)) / 86_400_000;
  const recent = past.filter((e) => days(e.at) < 7);
  if (recent.length) {
    const n = Math.floor(days(recent[recent.length - 1].at));
    return n ? `se buscó hace ${n} ${n === 1 ? "día" : "días"}` : "se buscó hoy";
  }
  const poor = past.find((e) => days(e.at) < 30 && typeof e.created === "number" && e.created / e.rows < MIN_NEW_SHARE);
  if (poor) return `agotada: el ${poor.at.slice(0, 10)} trajo ${poor.created} nuevos de ${poor.rows} filas`;
  return null;
}
