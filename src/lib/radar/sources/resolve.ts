import { load } from "cheerio";
import type { CompanySource, SourceProvider } from "../types";
import { parseJsonLdJobs, robotsAllowed } from "./adapters";
import { companyDomain, fold } from "../identity";
import { NetError, assertSafeUrl, safeGet, safeGetJson, sanitizeError, type NetOptions } from "./net";

/**
 * Resolución de la fuente de una empresa a partir de su link de Careers:
 * 1. el link ya es de un ATS (Greenhouse, Lever, Ashby);
 * 2. si no, se lee la página (redirects validados) y se busca un ATS enlazado o embebido;
 * 3. si no hay ATS y robots lo permite, JSON-LD JobPosting en la página;
 * 4. si nada de eso, `manual`.
 * La validación del board contra la API la hace la primera lectura (un 404 deja la fuente en error).
 */

export type AtsRef = { provider: Extract<SourceProvider, "greenhouse" | "lever" | "ashby">; boardId: string; region?: "us" | "eu" };

const BAD_SLUGS = new Set(["embed", "jobs", "job_board", "v1", "api", "posting-api", "careers", "js"]);
const okSlug = (s: string | null | undefined) => !!s && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(s) && !BAD_SLUGS.has(s.toLowerCase());

/** ATS a partir de una URL (link directo, API o embed). */
export function atsFromUrl(raw: string): AtsRef | null {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^\/\//, "https://"));
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const eu = host.includes(".eu.") ? "eu" : "us";
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const forParam = u.searchParams.get("for");
    if (okSlug(forParam)) return { provider: "greenhouse", boardId: forParam!, region: eu };
    if (/^boards-api/.test(host) && parts[0] === "v1" && parts[1] === "boards" && okSlug(parts[2])) return { provider: "greenhouse", boardId: parts[2], region: eu };
    if (/^(job-boards|boards)(\.eu)?\.greenhouse\.io$/.test(host) && okSlug(parts[0])) return { provider: "greenhouse", boardId: parts[0], region: eu };
    return null;
  }
  if (/^jobs(\.eu)?\.lever\.co$/.test(host) && okSlug(parts[0])) return { provider: "lever", boardId: parts[0], region: eu };
  if (/^api(\.eu)?\.lever\.co$/.test(host) && parts[1] === "postings" && okSlug(parts[2])) return { provider: "lever", boardId: parts[2], region: eu };
  if (host === "jobs.ashbyhq.com" && okSlug(parts[0])) return { provider: "ashby", boardId: parts[0] };
  if (host === "api.ashbyhq.com" && parts[0] === "posting-api" && parts[1] === "job-board" && okSlug(parts[2])) return { provider: "ashby", boardId: parts[2] };
  return null;
}

/** Busca un ATS enlazado o embebido en el HTML (links, iframes, scripts). Devuelve el más frecuente. */
export function atsInHtml(html: string, baseUrl: string): AtsRef | null {
  const $ = load(html);
  const counts = new Map<string, { ref: AtsRef; n: number }>();
  $("a[href], iframe[src], script[src], link[href]").each((_, el) => {
    const v = $(el).attr("href") ?? $(el).attr("src");
    if (!v) return;
    let abs: string;
    try {
      abs = new URL(v, baseUrl).toString();
    } catch {
      return;
    }
    const ref = atsFromUrl(abs);
    if (!ref) return;
    const k = `${ref.provider}:${ref.boardId.toLowerCase()}`;
    const cur = counts.get(k) ?? { ref, n: 0 };
    cur.n++;
    counts.set(k, cur);
  });
  // Ashby y Greenhouse embebidos por script sin link: "ashby_jid", Grnhse.Iframe.Load("slug")
  const inline = html.match(/(?:jobs\.ashbyhq\.com|boards\.greenhouse\.io\/embed\/job_board\/js\?for=|jobs\.lever\.co)\/?([A-Za-z0-9._-]+)/);
  if (!counts.size && inline) {
    const ref = atsFromUrl(`https://${inline[0].replace(/^\/+/, "")}`);
    if (ref) counts.set("inline", { ref, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.ref ?? null;
}

/** ATS que Radar todavía no lee: se informa en la nota para que la persona sepa por qué queda manual. */
const UNSUPPORTED: [RegExp, string][] = [
  [/teamtailor\.com|teamtailor-cdn/i, "Teamtailor"],
  [/bamboohr\.com\/(jobs|careers)/i, "BambooHR"],
  [/myworkdayjobs\.com/i, "Workday"],
  [/rippling(-ats)?\.com\/[^"']*jobs|ats\.rippling\.com/i, "Rippling"],
  [/smartrecruiters\.com/i, "SmartRecruiters"],
  [/apply\.workable\.com/i, "Workable"],
  [/recruitee\.com/i, "Recruitee"],
  [/personio\.(de|com)/i, "Personio"],
  [/jobs\.gem\.com/i, "Gem"],
];
export function unsupportedAts(html: string): string | null {
  return UNSUPPORTED.find(([re]) => re.test(html))?.[1] ?? null;
}

const compact = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");
/** Nombre comparable: sin sufijos societarios ni genéricos ("Acme Inc", "Mistral AI", "Acme GmbH"). */
const coreName = (s: string) => compact(fold(s).replace(/\b(inc|llc|ltd|gmbh|s\.?a\.?|srl|sas|corp|corporation|company|co|ai|hq|technologies|labs|careers|jobs)\b\.?/g, " "));

/**
 * Board deducido del nombre o del dominio, sólo si la API pública lo confirma:
 * Greenhouse devuelve el nombre del board (tiene que coincidir con la empresa); en Lever y Ashby,
 * que no lo devuelven, el slug tiene que coincidir a la vez con el nombre y con el dominio.
 */
export async function probeBoards(companyName: string, careersUrl: string, net: NetOptions): Promise<AtsRef | null> {
  const name = compact(companyName);
  const core = coreName(companyName);
  const label = (companyDomain(careersUrl) ?? "").split(".")[0];
  if (!name) return null;
  const candidates = [...new Set([name, label, fold(companyName).replace(/[^a-z0-9]+/g, "-")].filter((x) => /^[a-z0-9][a-z0-9-]{1,60}$/.test(x)))];
  const quiet: NetOptions = { ...net, retries: 0, maxBytes: 2_000_000 };
  for (const slug of candidates) {
    try {
      const b = (await safeGetJson(`https://boards-api.greenhouse.io/v1/boards/${slug}`, quiet)) as { name?: unknown };
      const n = typeof b?.name === "string" ? coreName(b.name) : "";
      if (n && n === core) return { provider: "greenhouse", boardId: slug, region: "us" };
    } catch {
      // no existe: seguimos
    }
  }
  if (!label || compact(label) !== name) return null;
  try {
    const jobs = (await safeGetJson(`https://api.ashbyhq.com/posting-api/job-board/${label}`, quiet)) as { jobs?: unknown[] };
    if (Array.isArray(jobs?.jobs)) return { provider: "ashby", boardId: label };
  } catch {
    // no existe
  }
  for (const region of ["us", "eu"] as const) {
    try {
      const list = await safeGetJson(`https://api${region === "eu" ? ".eu" : ""}.lever.co/v0/postings/${label}?mode=json&limit=1`, quiet);
      if (Array.isArray(list)) return { provider: "lever", boardId: label, region };
    } catch {
      // no existe
    }
  }
  return null;
}

export type Resolution = Pick<CompanySource, "provider" | "externalBoardId" | "region" | "resolvedUrl" | "status" | "statusNote"> & { attempts: number };

export async function resolveSource(careersUrl: string, net: NetOptions = {}, opts: { companyName?: string } = {}): Promise<Resolution> {
  let attempts = 0;
  const counted: NetOptions = { ...net, onAttempt: () => { attempts++; net.onAttempt?.(); } };
  const direct = atsFromUrl(careersUrl);
  if (direct) return { provider: direct.provider, externalBoardId: direct.boardId, region: direct.region, resolvedUrl: careersUrl, status: "pending", statusNote: "ATS detectado en el link", attempts };

  // robots.txt antes de leer la página de la empresa.
  try {
    await assertSafeUrl(careersUrl, net.resolve);
    if (!(await robotsAllowed(careersUrl, counted))) return { provider: "careers", externalBoardId: null, resolvedUrl: null, status: "manual", statusNote: "robots.txt no permite leer la página", attempts };
  } catch (err) {
    const blocked = err instanceof NetError && err.kind === "blocked";
    return { provider: "careers", externalBoardId: null, resolvedUrl: null, status: blocked ? "manual" : "error", statusNote: sanitizeError(err), attempts };
  }
  let page;
  try {
    page = await safeGet(careersUrl, { ...counted, accept: "text/html", maxBytes: 3 * 1024 * 1024, retries: 1 });
  } catch (err) {
    const blocked = err instanceof NetError && err.kind === "blocked";
    return { provider: "careers", externalBoardId: null, resolvedUrl: null, status: blocked ? "manual" : "error", statusNote: sanitizeError(err), attempts };
  }
  const viaRedirect = atsFromUrl(page.url);
  const found = viaRedirect ?? atsInHtml(page.text, page.url);
  if (found) return { provider: found.provider, externalBoardId: found.boardId, region: found.region, resolvedUrl: page.url, status: "pending", statusNote: viaRedirect ? "ATS detectado por redirección" : "ATS detectado en la página", attempts };

  const jobs = parseJsonLdJobs(page.text, page.url);
  if (jobs.length) {
    return { provider: "jsonld", externalBoardId: null, resolvedUrl: page.url, status: "pending", statusNote: "La página publica JobPosting (JSON-LD)", attempts };
  }
  if (opts.companyName) {
    const probed = await probeBoards(opts.companyName, page.url, counted);
    if (probed) return { provider: probed.provider, externalBoardId: probed.boardId, region: probed.region, resolvedUrl: page.url, status: "pending", statusNote: "Board deducido del nombre y confirmado por la API pública", attempts };
  }
  const other = unsupportedAts(page.text);
  const note = other ? `Usa ${other}, que Radar todavía no lee: revisión manual` : "Sin ATS público ni JobPosting en la página: revisión manual";
  return { provider: "careers", externalBoardId: null, resolvedUrl: page.url, status: "manual", statusNote: note, attempts };
}
