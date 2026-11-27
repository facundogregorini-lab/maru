import type { SourceProvider } from "./types";

/**
 * Identidad de una empresa: el dominio canónico si hay uno (`d:openai.com`); si no, un slug del nombre,
 * marcado como identidad provisoria (`s:the-exploration-company`). Nunca se fusiona por parecido de nombre:
 * "OLIVER Agency" y "OLIVER Agency - Argentina" son dos empresas.
 */

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function slugify(name: string): string {
  return fold(name)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Hosts de ATS y portales: el dominio no es el de la empresa. */
const SHARED_HOSTS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workable.com",
  "smartrecruiters.com",
  "teamtailor.com",
  "breezy.hr",
  "bamboohr.com",
  "recruitee.com",
  "myworkdayjobs.com",
  "workday.com",
  "icims.com",
  "jobvite.com",
  "personio.de",
  "personio.com",
  "linkedin.com",
  "notion.site",
  "notion.so",
  "google.com",
  "docs.google.com",
  "wellfound.com",
  "angel.co",
  "ycombinator.com",
  "getonbrd.com",
  "hiringroom.com",
  "gupy.io",
  "pinpointhq.com",
  "rippling.com",
  "rippling-ats.com",
  "join.com",
  "welcometothejungle.com",
];

/** Sufijos de dos niveles frecuentes (no hay lista pública en el repo; alcanza para registrables comunes). */
const TWO_LEVEL = /\.(com|co|org|net|gob|gov|edu|ac|ltd|plc)\.[a-z]{2}$/;

export function hostOf(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase().replace(/\.$/, "");
    if (!h.includes(".") || /^\d+(\.\d+){3}$/.test(h) || h.includes(":")) return null;
    return h;
  } catch {
    return null;
  }
}

export function registrableDomain(host: string): string {
  const parts = host.replace(/^www\./, "").split(".");
  const n = TWO_LEVEL.test(host) ? 3 : 2;
  return parts.slice(-n).join(".");
}

export function isSharedHost(host: string): boolean {
  return SHARED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Dominio de la empresa a partir de un link de Careers o de su web, o null si es un ATS/portal o no es válido. */
export function companyDomain(raw: string): string | null {
  const host = hostOf(raw);
  if (!host || isSharedHost(host)) return null;
  return registrableDomain(host);
}

export const companyIdFor = (domain: string | null, name: string) => (domain ? `d:${domain}` : `s:${slugify(name)}`);

/** Tipo de fuente y board id a partir del link de Careers (sin red: se confirma en la sesión 3). */
export function detectProvider(raw: string): { provider: SourceProvider; boardId: string | null } {
  const host = hostOf(raw);
  if (!host) return { provider: "careers", boardId: null };
  let path: string[] = [];
  try {
    path = new URL(/^[a-z]+:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`).pathname.split("/").filter(Boolean);
  } catch {
    // ya validado por hostOf
  }
  if (host.endsWith("greenhouse.io")) {
    const embed = path[0] === "embed" ? null : path[0];
    return { provider: "greenhouse", boardId: embed ?? null };
  }
  if (host.endsWith("lever.co")) return { provider: "lever", boardId: path[0] ?? null };
  if (host === "jobs.ashbyhq.com") return { provider: "ashby", boardId: path[0] ?? null };
  return { provider: "careers", boardId: null };
}

/** Normaliza un link http(s) público (sin red ni IP literales). null si no sirve. */
export function cleanUrl(raw: string): string | null {
  const host = hostOf(raw);
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  const s = raw.trim();
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}
