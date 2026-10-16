/** Pruebas manuales con claves de servidor. Nunca incorpora resultados al inventario. */
import { canonicalUrl, htmlToText } from "./text";

export type PilotProvider = "fantastic" | "serp";
export type PilotJob = { id: string; title: string; company: string; location: string; source: string; url: string; publishedAt: string; descriptionChars: number; excerpt: string; usable: boolean; issues: string[]; duplicate: boolean };
export type PilotResult = { provider: PilotProvider; checkedAt: string; action: "status" | "sample"; quota: Record<string, string | number | null>; counts?: Record<string, number>; jobs?: PilotJob[]; summary?: { received: number; usable: number; newUsable: number; duplicates: number }; note: string };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const string = (v: unknown) => typeof v === "string" ? v.trim() : "";
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const strings = (v: unknown) => list(v).map(string).filter(Boolean);
function safeUrl(value: unknown): string {
  try {
    const url = new URL(string(value));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    if ([...url.searchParams.keys()].some((k) => /token|api.?key|secret|signature/i.test(k))) return "";
    return url.href;
  } catch { return ""; }
}
export class ProviderError extends Error {
  constructor(message: string, public code = "PROVIDER_FAILED") { super(message); }
}

/** URLs fijas; sin redirects, reintentos ni errores del proveedor que puedan incluir credenciales. */
async function request(url: URL, headers?: HeadersInit) {
  let response: Response;
  try { response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(55_000) }); }
  catch { throw new ProviderError("El proveedor no respondió a tiempo. No se reintentó la consulta."); }
  if (!response.ok) throw new ProviderError(`El proveedor respondió HTTP ${response.status}. Revisá la clave, el plan y la cuota en su panel.`);
  if (Number(response.headers.get("content-length")) > 4_000_000) throw new ProviderError("La respuesta excede el límite de la prueba.");
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError("El proveedor devolvió una respuesta vacía.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 4_000_000) { await reader.cancel(); throw new ProviderError("La respuesta excede el límite de la prueba."); }
      chunks.push(part.value);
    }
    return { body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown, headers: response.headers };
  } catch (e) { if (e instanceof ProviderError) throw e; throw new ProviderError("El proveedor devolvió una respuesta que no pudimos leer."); }
}
function fantasticQuota(headers: Headers): PilotResult["quota"] {
  const out: PilotResult["quota"] = {};
  for (const key of ["jobs-this-request", "jobs-remaining", "jobs-limit", "requests-remaining", "requests-limit"]) {
    const value = headers.get(`x-api-${key}`);
    out[key] = value !== null && /^\d+$/.test(value) ? Number(value) : null;
  }
  return out;
}
function count(body: unknown): number {
  const raw = object(body).count;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) throw new ProviderError("El formato del conteo cambió; revisá la documentación del proveedor.");
  return raw;
}
async function fantasticCall(endpoint: string, key: string, params: Record<string, string>) {
  const url = new URL(`https://data.fantastic.jobs/v1/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return request(url, { Authorization: `Bearer ${key}` });
}
async function serpAccount(key: string) {
  const url = new URL("https://serpapi.com/account.json"); url.searchParams.set("api_key", key);
  const { body } = await request(url); const r = object(body);
  if (r.error) throw new ProviderError("SerpAPI no pudo consultar la cuenta. Revisá la clave en su panel.");
  const quota: PilotResult["quota"] = {};
  // Account API incluye api_key y email: devolvemos exclusivamente esta lista.
  for (const field of ["plan_name", "plan_searches_left", "total_searches_left", "searches_per_month", "this_month_usage", "plan_monthly_price"]) {
    const value = r[field]; if (typeof value === "string" || typeof value === "number") quota[field] = value;
  }
  return quota;
}

export function pilotJobs(provider: PilotProvider, rawRows: unknown[], existingUrls: string[], now = Date.now()): PilotJob[] {
  const seen = new Set(existingUrls.map(canonicalUrl));
  return rawRows.slice(0, 50).map((raw) => {
    const r = object(raw); const fantastic = provider === "fantastic";
    const link = fantastic ? safeUrl(r.url) : list(r.apply_options).map((v) => safeUrl(object(v).link)).find(Boolean) || "";
    const description = htmlToText(string(fantastic ? r.description_text : r.description), 100_000);
    const locations = fantastic ? strings(r.locations_derived).join(" · ") : string(r.location);
    const country = fantastic ? strings(r.countries_derived).some((v) => v.toLowerCase() === "argentina") || /\bargentina\b/i.test(locations) : /\bargentina\b|\bbuenos aires\b/i.test(locations);
    const title = string(r.title).slice(0, 300); const company = string(fantastic ? r.organization : r.company_name).slice(0, 200);
    const issues: string[] = [];
    if (!title || !company || !link) issues.push("Faltan título, empresa o enlace de postulación");
    if (description.length < 300) issues.push("Descripción menor a 300 caracteres");
    if (!country) issues.push("Argentina por confirmar; el filtro de búsqueda no alcanza como evidencia");
    const expiry = string(r.date_valid_through); const published = string(r.date_posted);
    if (expiry && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) <= now) issues.push("Aviso vencido");
    if (published && Number.isFinite(Date.parse(published)) && now - Date.parse(published) > 30 * 86400000) issues.push("Publicado hace más de 30 días");
    const canonical = link ? canonicalUrl(link) : ""; const duplicate = !!canonical && seen.has(canonical);
    if (canonical) seen.add(canonical);
    return { id: String(r.id ?? r.job_id ?? "").slice(0, 300), title, company, location: locations.slice(0, 800), source: string(fantastic ? r.source : r.via).slice(0, 100), url: link, publishedAt: published, descriptionChars: description.length, excerpt: description.slice(0, 350), usable: !issues.length, issues, duplicate };
  });
}

export async function runProviderPilot(provider: PilotProvider, action: "status" | "sample", existingUrls: string[] = []): Promise<PilotResult> {
  const key = process.env[provider === "fantastic" ? "FANTASTIC_JOBS" : "SERP_API"]?.trim();
  if (!key) throw new ProviderError(`Falta ${provider === "fantastic" ? "FANTASTIC_JOBS" : "SERP_API"} en este deployment.`, "NOT_CONFIGURED");
  const checkedAt = new Date().toISOString();
  if (provider === "serp") {
    const quota = await serpAccount(key);
    const base: PilotResult = { provider, action, checkedAt, quota, note: "Cuenta consultada sin consumir búsquedas. La muestra usa una búsqueda (hasta 10 avisos), sin paginar ni contratar extras. No publica resultados." };
    if (action === "status") return base;
    if (typeof quota.plan_searches_left !== "number" || quota.plan_searches_left < 1) throw new ProviderError("No hay una búsqueda incluida disponible. No usamos créditos extra.", "QUOTA_LOW");
    const url = new URL("https://serpapi.com/search.json");
    Object.entries({ engine: "google_jobs", q: "analista Argentina", gl: "ar", hl: "es", location: "Buenos Aires, Argentina", api_key: key }).forEach(([k, v]) => url.searchParams.set(k, v));
    const { body } = await request(url); const data = object(body);
    if (data.error || string(object(data.search_metadata).status) === "Error") throw new ProviderError("Google Jobs no devolvió la búsqueda. Revisá el estado en SerpAPI; no se reintentó.");
    if (!Array.isArray(data.jobs_results)) throw new ProviderError("La búsqueda no devolvió una lista de avisos.");
    const jobs = pilotJobs(provider, data.jobs_results.slice(0, 10), existingUrls);
    return { ...base, jobs, summary: summarize(jobs), note: `${base.note} La cuota mostrada corresponde al momento previo a la búsqueda.` };
  }
  // Conteo sin créditos de avisos; además permite frenar antes de exceder el saldo incluido.
  const first = await fantasticCall("active-ats-count", key, { time_frame: action === "status" ? "1m" : "7d", location: "Argentina" });
  const quota = fantasticQuota(first.headers);
  const base: PilotResult = { provider, action, checkedAt, quota, note: "Filtro Argentina. Los conteos consumen requests, pero no créditos de avisos. 1m mide indexados en 31 días, incluidos vencidos; 24h mide activos. La muestra busca analista, últimos 7 días, hasta 25 ATS + 25 job boards. Sin importación ni recurrencia." };
  if (action === "status") {
    const counts: Record<string, number> = { ats_1m: count(first.body) };
    for (const [label, endpoint, frame] of [["ats_24h", "active-ats-count", "24h"], ["jobboards_1m", "active-jb-count", "1m"], ["jobboards_24h", "active-jb-count", "24h"]]) {
      const result = await fantasticCall(endpoint, key, { time_frame: frame, location: "Argentina" }); counts[label] = count(result.body);
      Object.assign(quota, fantasticQuota(result.headers));
    }
    return { ...base, counts };
  }
  if (typeof quota["jobs-remaining"] !== "number" || quota["jobs-remaining"] < 50 || typeof quota["requests-remaining"] !== "number" || quota["requests-remaining"] < 2) throw new ProviderError("La prueba requiere 50 créditos de avisos y dos requests incluidos disponibles. No habilitamos excedentes.", "QUOTA_LOW");
  const rows: unknown[] = []; let consumed = 0;
  for (const endpoint of ["active-ats", "active-jb"]) {
    const response = await fantasticCall(endpoint, key, { time_frame: "7d", location: "Argentina", title: "analista", limit: "25", description_format: "text", ...(endpoint === "active-jb" ? { exclude_recruiter_fields: "true" } : {}) });
    if (!Array.isArray(response.body)) throw new ProviderError("Cambió el formato de los avisos. Revisá la documentación del proveedor.");
    rows.push(...response.body.slice(0, 25));
    const q = fantasticQuota(response.headers); consumed += typeof q["jobs-this-request"] === "number" ? q["jobs-this-request"] : response.body.length;
    Object.assign(quota, q);
  }
  quota["jobs-this-request"] = consumed;
  const jobs = pilotJobs(provider, rows, existingUrls);
  return { ...base, jobs, summary: summarize(jobs) };
}
function summarize(jobs: PilotJob[]) {
  return { received: jobs.length, usable: jobs.filter((j) => j.usable).length, newUsable: jobs.filter((j) => j.usable && !j.duplicate).length, duplicates: jobs.filter((j) => j.duplicate).length };
}
