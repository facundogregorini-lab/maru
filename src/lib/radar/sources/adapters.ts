import { load } from "cheerio";
import { z } from "zod";
import { normalizeAshby, normalizeGreenhouse, normalizeLever, type Board } from "../../match/connectors";
import { htmlToText } from "../../match/text";
import type { NormalizedPosting } from "../../match/types";
import type { CompanySource, RemoteType, SourceProvider } from "../types";
import { NetError, safeGet, safeGetJson, type NetOptions } from "./net";

/**
 * Adaptadores de fuentes con una interfaz común. Cada uno lee UNA fuente (global, no por persona),
 * valida la respuesta con Zod y devuelve un snapshot normalizado. `complete` = vino entero: sólo un snapshot
 * completo puede contar ausencias para cerrar vacantes. Nada de LinkedIn ni de eludir login, CAPTCHA o robots.
 */

export type RadarPosting = {
  externalId: string;
  title: string;
  url: string;
  location: string;
  remoteType: RemoteType;
  department: string;
  publishedAt: string | null;
  description: string;
};

export type Snapshot = {
  jobs: RadarPosting[];
  complete: boolean;
  received: number;
  /** Ids que la fuente informa como cerrados explícitamente (si los da). */
  closedIds?: string[];
  /** Ajustes que descubre la lectura (región de Lever, URL final). */
  patch?: Partial<Pick<CompanySource, "region" | "resolvedUrl">>;
  note?: string;
};

export type Adapter = (source: CompanySource, net: NetOptions) => Promise<Snapshot>;

const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
function slugOf(source: CompanySource): string {
  const s = source.externalBoardId ?? "";
  if (!SLUG.test(s)) throw new NetError("Board inválido", "invalid");
  return encodeURIComponent(s);
}

const MAX_DESC = 4000;
const clip = (s: string | undefined | null, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const httpsOr = (u: string, fallback: string) => {
  try {
    return new URL(u).protocol === "https:" ? u : fallback;
  } catch {
    return fallback;
  }
};
const REMOTE: Record<string, RemoteType> = { remoto: "remoto", hibrido: "hibrido", presencial: "presencial", desconocido: "desconocido" };

function fromNormalized(p: NormalizedPosting, fallbackUrl: string): RadarPosting {
  return {
    externalId: clip(p.externalId, 120),
    title: clip(p.title, 200),
    url: httpsOr(p.sourceUrl, fallbackUrl),
    location: clip(p.locations.join(" · "), 200),
    remoteType: REMOTE[p.workplace.value] ?? "desconocido",
    department: clip(p.department, 120),
    publishedAt: p.publishedAt,
    description: (p.descriptionText ?? "").slice(0, MAX_DESC),
  };
}

const board = (source: CompanySource, sourceId: Board["sourceId"]): Board => ({
  sourceId,
  boardId: `${sourceId}:${source.externalBoardId}`,
  slug: source.externalBoardId ?? "",
  region: source.region,
  company: "",
});

/* ---------- Greenhouse (Job Board API) ---------- */

const ghSchema = z.object({
  jobs: z.array(
    z.looseObject({
      id: z.union([z.number(), z.string()]),
      title: z.string().min(1),
      absolute_url: z.string().url(),
      content: z.string().optional().nullable(),
      updated_at: z.string().optional().nullable(),
      first_published: z.string().optional().nullable(),
      location: z.looseObject({ name: z.string().optional().nullable() }).optional().nullable(),
    }),
  ),
  meta: z.looseObject({ total: z.number().optional() }).optional(),
});

export const greenhouse: Adapter = async (source, net) => {
  const host = source.region === "eu" ? "boards-api.eu.greenhouse.io" : "boards-api.greenhouse.io";
  // Boards grandes (600+ avisos con descripción) pesan 10-20 MB.
  const raw = await safeGetJson(`https://${host}/v1/boards/${slugOf(source)}/jobs?content=true`, { maxBytes: 30 * 1024 * 1024, ...net });
  const r = ghSchema.safeParse(raw);
  if (!r.success) throw new NetError("Respuesta de Greenhouse con un formato inesperado", "invalid");
  const b = board(source, "greenhouse");
  const jobs = r.data.jobs.map((j) => fromNormalized(normalizeGreenhouse({ ...j, id: Number(j.id), content: j.content ?? undefined, location: { name: j.location?.name ?? undefined } } as Parameters<typeof normalizeGreenhouse>[0], b), source.careersUrl));
  const total = r.data.meta?.total;
  return { jobs, complete: total === undefined || total === jobs.length, received: jobs.length };
};

/* ---------- Lever (Postings API, US y EU, paginada) ---------- */

const leverSchema = z.array(
  z.looseObject({
    id: z.string().min(1),
    text: z.string().min(1),
    hostedUrl: z.string().url(),
    categories: z.looseObject({}).optional(),
    createdAt: z.number().optional(),
  }),
);

export const LEVER_PAGE = 100;
const LEVER_MAX_PAGES = 20;

export const lever: Adapter = async (source, net) => {
  const regions: ("us" | "eu")[] = source.region ? [source.region] : ["us", "eu"];
  let lastErr: unknown = null;
  for (const region of regions) {
    const host = region === "eu" ? "api.eu.lever.co" : "api.lever.co";
    try {
      const out: RadarPosting[] = [];
      let complete = false;
      for (let page = 0; page < LEVER_MAX_PAGES; page++) {
        const raw = await safeGetJson(`https://${host}/v0/postings/${slugOf(source)}?mode=json&skip=${page * LEVER_PAGE}&limit=${LEVER_PAGE}`, net);
        const r = leverSchema.safeParse(raw);
        if (!r.success) throw new NetError("Respuesta de Lever con un formato inesperado", "invalid");
        const b = board(source, "lever");
        out.push(...r.data.map((p) => fromNormalized(normalizeLever(p as Parameters<typeof normalizeLever>[0], b), source.careersUrl)));
        if (r.data.length < LEVER_PAGE) {
          complete = true;
          break;
        }
      }
      return { jobs: out, complete, received: out.length, patch: { region }, note: complete ? undefined : "Paginación incompleta" };
    } catch (err) {
      lastErr = err;
      // Un board de Lever existe en una sola región: 404 en US → probar EU.
      if (!(err instanceof NetError && err.status === 404)) throw err;
    }
  }
  throw lastErr;
};

/* ---------- Ashby (public job posting API) ---------- */

const ashbySchema = z.object({
  jobs: z.array(
    z.looseObject({
      id: z.string().optional(),
      title: z.string().min(1),
      jobUrl: z.string().url(),
      isListed: z.boolean().optional(),
    }),
  ),
});

export const ashby: Adapter = async (source, net) => {
  const raw = await safeGetJson(`https://api.ashbyhq.com/posting-api/job-board/${slugOf(source)}`, net);
  const r = ashbySchema.safeParse(raw);
  if (!r.success) throw new NetError("Respuesta de Ashby con un formato inesperado", "invalid");
  const b = board(source, "ashby");
  // isListed=false: el empleador no quiere que aparezca en listados.
  const listed = r.data.jobs.filter((j) => j.isListed !== false);
  return { jobs: listed.map((j) => fromNormalized(normalizeAshby(j as Parameters<typeof normalizeAshby>[0], b), source.careersUrl)), complete: true, received: r.data.jobs.length };
};

/* ---------- robots.txt ---------- */

/** true si robots.txt deja leer `path` a nuestro bot (o a "*"). Sin robots.txt (404): permitido. */
export function robotsAllows(robots: string, path: string, agent = "maruradarbot"): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const line of robots.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    const m = clean.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      lastWasAgent = false;
      if (value) cur.rules.push({ allow: key === "allow", path: value });
    } else lastWasAgent = false;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const pick = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  const rules = pick.flatMap((g) => g.rules);
  const matches = (rule: string) => {
    const re = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
    return re.test(path);
  };
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) if (matches(r.path) && (!best || r.path.length > best.len || (r.path.length === best.len && r.allow))) best = { allow: r.allow, len: r.path.length };
  return best ? best.allow : true;
}

export async function robotsAllowed(pageUrl: string, net: NetOptions): Promise<boolean> {
  const u = new URL(pageUrl);
  try {
    const r = await safeGet(`${u.origin}/robots.txt`, { ...net, accept: "text/plain", maxBytes: 500_000, retries: 1 });
    return robotsAllows(r.text, u.pathname + u.search);
  } catch (err) {
    // Sin robots.txt se puede leer; si el servidor falla, no leemos (prudente).
    if (err instanceof NetError && (err.status === 404 || err.status === 410)) return true;
    return false;
  }
}

/* ---------- JSON-LD JobPosting ---------- */

type Ld = Record<string, unknown>;
const asArray = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const str = (x: unknown) => (typeof x === "string" ? x : typeof x === "number" ? String(x) : "");

function flattenLd(node: unknown, out: Ld[] = []): Ld[] {
  for (const n of asArray(node as Ld | Ld[])) {
    if (!n || typeof n !== "object") continue;
    out.push(n);
    if ((n as Ld)["@graph"]) flattenLd((n as Ld)["@graph"], out);
    if ((n as Ld).itemListElement) flattenLd(asArray((n as Ld).itemListElement as Ld[]).map((e) => (e as Ld).item ?? e), out);
  }
  return out;
}

const isJobPosting = (n: Ld) => asArray(n["@type"] as string | string[]).some((t) => t === "JobPosting");

function placeOf(n: Ld): string {
  return asArray(n.jobLocation as Ld | Ld[])
    .map((l) => {
      const a = (l?.address ?? {}) as Ld;
      return [str(a.addressLocality), str(a.addressRegion), str(a.addressCountry && typeof a.addressCountry === "object" ? (a.addressCountry as Ld).name : a.addressCountry)].filter(Boolean).join(", ");
    })
    .filter(Boolean)
    .join(" · ");
}

/** Lee los JobPosting de una página (HTML no confiable: sólo texto, nada se ejecuta). */
export function parseJsonLdJobs(html: string, pageUrl: string): RadarPosting[] {
  const $ = load(html);
  const nodes: Ld[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      flattenLd(JSON.parse($(el).text()), nodes);
    } catch {
      // bloque mal formado: se ignora
    }
  });
  const out: RadarPosting[] = [];
  const seen = new Set<string>();
  for (const n of nodes.filter(isJobPosting)) {
    const title = clip(str(n.title), 200);
    if (!title) continue;
    const ident = n.identifier as Ld | string | undefined;
    const url = httpsOr(str(n.url) ? new URL(str(n.url), pageUrl).toString() : pageUrl, pageUrl);
    const externalId = clip(typeof ident === "object" ? str(ident?.value) : str(ident), 120) || url;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const remote = /telecommute/i.test(str(n.jobLocationType));
    out.push({
      externalId,
      title,
      url,
      location: clip(placeOf(n), 200),
      remoteType: remote ? "remoto" : "desconocido",
      department: "",
      publishedAt: str(n.datePosted) && !Number.isNaN(Date.parse(str(n.datePosted))) ? new Date(str(n.datePosted)).toISOString() : null,
      description: htmlToText(str(n.description), MAX_DESC),
    });
  }
  return out;
}

export const jsonld: Adapter = async (source, net) => {
  const url = source.resolvedUrl || source.careersUrl;
  if (!(await robotsAllowed(url, net))) throw new NetError("robots.txt no permite leer la página", "blocked");
  const page = await safeGet(url, { ...net, accept: "text/html", maxBytes: 3 * 1024 * 1024 });
  const jobs = parseJsonLdJobs(page.text, page.url);
  // Una página de Careers puede mostrar sólo una parte: nunca cuenta como snapshot completo.
  return { jobs, complete: false, received: jobs.length, note: "JSON-LD: lectura parcial por diseño (no cierra vacantes)" };
};

export const ADAPTERS: Partial<Record<SourceProvider, Adapter>> = { greenhouse, lever, ashby, jsonld };
