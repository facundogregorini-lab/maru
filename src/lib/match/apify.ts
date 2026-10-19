import type { NormalizedPosting } from "./types";
import { htmlToText } from "./text";

export const APIFY_JOBS = {
  linkedin: { actor: "curious_coder/linkedin-jobs-scraper", name: "LinkedIn", fields: ["id", "title", "companyName", "link", "applyUrl", "location", "descriptionText", "postedAt", "salary", "seniorityLevel", "employmentType", "companyLogo"] },
  indeed: { actor: "curious_coder/indeed-scraper", name: "Indeed", fields: ["id", "title", "companyDetails.name", "viewJobLink", "originalApplyUrl", "formattedLocation", "location.countryCode", "jobDescription", "pubDate", "expirationDate", "expired", "salary", "jobTypes", "companyDetails.logoUrl", "companyLogoUrl"] },
  computrabajo: { actor: "shahidirfan/Computrabajo-Jobs-Scraper", name: "Computrabajo", fields: ["id", "title", "company", "url", "applyUrl", "location", "descriptionText", "postedDate", "updatedAt", "salary", "jobType", "companyLogo", "logo"] },
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
export const LINKEDIN_ALT_FIELDS = ["id", "jobId", "title", "jobTitle", "companyName", "company", "link", "url", "jobUrl", "applyUrl", "location", "descriptionHtml", "descriptionText", "description", "jobDescription", "postedAt", "publishedAt", "postedDate", "salary", "salaryInfo", "seniorityLevel", "experienceLevel", "employmentType", "contractType", "companyLogo", "companyLogoUrl"] as const;
/** Títulos que los Actors pueden descartar antes de cobrar la fila (el filtro fino es import-filter.ts). */
export const LINKEDIN_TITLE_EXCLUDE = ["chofer", "operario", "repartidor", "cadete", "cajero", "repositor", "mozo", "vigilador", "mostrador", "promotor", "telemarketer", "call center"];
/** Ubicaciones de LinkedIn que abarcan a la Argentina sin nombrarla: la elegibilidad decide con el texto del aviso. */
const LATAM_LOCATION = /\b(latin america|latam|latinoam[eé]rica|am[eé]rica latina|south america|sudam[eé]rica)\b/i;
export const linkedinJobId = (link: string) => /\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/.exec(link)?.[1] ?? "";
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
    const rawId = str(r.id) || (typeof r.id === "number" ? String(r.id) : "") || str(r.jobId) || (typeof r.jobId === "number" ? String(r.jobId) : "");
    const title = str(r.title) || str(r.jobTitle);
    const company = source === "linkedin" ? str(r.companyName) || str(r.company) || str(obj(r.company).name) : source === "indeed" ? str(r["companyDetails.name"]) || str(obj(r.companyDetails).name) : str(r.company);
    // El HTML conserva los párrafos y las listas: sin ellos no se separan requisitos de deseables
    // (valig trae "description" en texto plano pegado, sin saltos de línea).
    const description = htmlToText(str(r.descriptionHtml) || str(r.descriptionText) || str(r.jobDescription) || str(r.description), 100000);
    const sourceUrl = source === "linkedin" ? url(r.link) || url(r.jobUrl) || url(r.url) : source === "indeed" ? url(r.viewJobLink, "https://ar.indeed.com") : url(r.url);
    const applyUrl = source === "indeed" ? url(r.originalApplyUrl) || sourceUrl : url(r.applyUrl) || sourceUrl;
    // En LinkedIn el id sale del enlace: así coinciden los avisos que traen Actors distintos.
    const id = (source === "linkedin" && linkedinJobId(sourceUrl)) || rawId;
    const publishedAt = date(r.postedAt ?? r.pubDate ?? r.postedDate ?? r.publishedAt);
    const expiresAt = date(r.expirationDate);
    if (!id || !title || !company || !sourceUrl || !applyUrl) { reject("campos_obligatorios"); continue; }
    if (description.length < 300) { reject("descripcion_corta"); continue; }
    if (r.expired === true || (expiresAt && expiresAt <= now) || (publishedAt && Date.parse(now) - Date.parse(publishedAt) > 30 * 86400000)) { reject("vencido_o_antiguo"); continue; }
    const country = str(r["location.countryCode"]) || str(obj(r.location).countryCode);
    if (source === "indeed" && country.toUpperCase() !== "AR") { reject("pais_no_confirmado"); continue; }
    // LinkedIn devuelve el país en cada ubicación; Computrabajo AR lo identifica por el host.
    const location = str(r.formattedLocation) || str(r.location);
    const latam = source === "linkedin" && !/argentina|buenos aires/i.test(location) && LATAM_LOCATION.test(location);
    if (source === "linkedin" && !/argentina|buenos aires/i.test(location) && !latam) { reject("pais_no_confirmado"); continue; }
    if (source === "computrabajo" && new URL(sourceUrl).hostname !== "ar.computrabajo.com") { reject("pais_no_confirmado"); continue; }
    if (seen.has(id)) { reject("duplicado"); continue; }
    seen.add(id);
    // No convertimos salario “a convenir”, números sospechosos o 0 en una promesa salarial.
    const salaryText = str(r.salary) || str(r.salaryInfo) || (Array.isArray(r.salaryInfo) ? r.salaryInfo.map(str).filter(Boolean).join(" - ") : "");
    const salary = /[1-9]\d/.test(salaryText) ? { value: { min: null, max: null, currency: "", period: "desconocido" as const, text: salaryText }, from: "fuente" as const } : null;
    // Logo de la empresa si el Actor lo trae (sólo https; nunca fotos de personas).
    const logo = [r.companyLogo, r.companyLogoUrl, r.logo, r["companyDetails.logoUrl"], obj(r.companyDetails).logoUrl].map((v) => url(v)).find((u) => u.startsWith("https://"));
    postings.push({
      ...(logo ? { companyLogo: logo } : {}),
      sourceId: `apify-${source}`, boardId: `apify:${source}:ar`, externalId: id, title, company,
      sourceUrl, applyUrl, linkRequired: true, attribution: `Publicado en ${APIFY_JOBS[source].name} · vía Apify`,
      descriptionText: description.slice(0, 12000), descriptionComplete: description.length <= 12000,
      // "Latin America" no es un país: sin "AR" fijo, eligibility.ts mira la región y la descripción (p. ej. "US only").
      locations: location ? [location] : [], countries: latam ? [] : ["AR"], regionText: [],
      workplace: { value: "desconocido", from: "fuente" }, remoteFlag: null,
      employmentType: null, salary, publishedAt, updatedAt: date(r.updatedAt), expiresAt,
      employmentHint: str(r.employmentType) || str(r.contractType) || str(r.jobType) || (Array.isArray(r.jobTypes) ? r.jobTypes.map(str).filter(Boolean).join(", ") : ""),
      seniorityHint: str(r.seniorityLevel) || str(r.experienceLevel),
    });
  }
  return { postings, rejected, received: rows.length, accepted: postings.length };
}

export function apifyJobInput(source: ApifyJobSource, keyword: string, limit: number, maxLimit = 50, actor: LinkedinActor = "curious", window: "week" | "month" = "week", location = "Argentina") {
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) throw new Error(`Se admiten entre 1 y ${maxLimit} avisos por fuente.`);
  // Antigüedad máxima del aviso en los Actors alternativos: una semana (default) o un mes.
  const age = window === "month" ? "r2592000" : "r604800";
  if (source === "linkedin" && actor === "valig") return { keywords: keyword, location, datePosted: age, limit, titleExclude: LINKEDIN_TITLE_EXCLUDE };
  if (source === "linkedin" && actor === "cheap") return { keyword: [keyword], location, publishedAt: age, maxItems: limit, saveOnlyUniqueItems: true, enrichCompanyData: false, jobTitleExclude: LINKEDIN_TITLE_EXCLUDE };
  if (source === "linkedin") return { keywords: keyword, location: "Argentina", datePosted: "pastWeek", scrapeCompany: false, limitPerSource: limit, splitByLocation: false };
  if (source === "indeed") return { country: "ar", query: keyword, location: "Argentina", postedWithinDays: "7", count: limit };
  return { keyword, countryCode: "ar", maxJobs: limit, proxyConfiguration: { useApifyProxy: false } };
}

/**
 * Precio estimado por fila entregada (US$, docs/PROVEEDORES-AVISOS.md) y por inicio de Actor.
 * Se usa para frenar ANTES de pasarse del presupuesto: el costo real se registra después en el ledger.
 */
export const APIFY_PRICE_PER_ROW: Record<ApifyJobSource, number> = { linkedin: 0.002, indeed: 0.0001, computrabajo: 0.0015 };
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
};

const rowPrice = (source: ApifyJobSource, actor: LinkedinActor) => (source === "linkedin" ? LINKEDIN_ACTORS[actor].pricePerRow : APIFY_PRICE_PER_ROW[source]);

/** Peor caso de una corrida: inicio + todas las filas pedidas. */
export const apifyRunCeiling = (source: ApifyJobSource, rows: number, actor: LinkedinActor = "curious") => APIFY_START_USD + rows * rowPrice(source, actor);

/** Tope de la próxima corrida dentro del presupuesto acumulado; 0 = no correr. */
export function apifyNextCap(source: ApifyJobSource, rows: number, spentUsd: number, budgetUsd: number, actor: LinkedinActor = "curious"): number {
  const ceiling = apifyRunCeiling(source, rows, actor);
  return spentUsd + ceiling <= budgetUsd + 1e-9 ? Math.round(ceiling * 1000) / 1000 : 0;
}
