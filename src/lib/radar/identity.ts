import { companyKey } from "@/lib/match/group";
import type { IdentityKind } from "./types";

/**
 * Identidad de una empresa del Radar. Corre en el navegador (importación) y en el servidor (estado):
 * sin dependencias de node.
 */

/** Bolsa de ATS a partir de una URL pública de empleo. Mismo formato de id que el directorio de Match (`fuente:slug`). */
export function boardFromUrl(raw: string | undefined | null): string | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const first = (parts[0] ?? "").toLowerCase();
  const sub = (suffix: string) => (host.endsWith(suffix) ? host.slice(0, -suffix.length) : "");
  if (/^(job-boards|boards)(\.eu)?\.greenhouse\.io$/.test(host) && first) return `greenhouse:${first}`;
  if (/^jobs(\.eu)?\.lever\.co$/.test(host) && first) return `lever:${first}`;
  if (host === "jobs.ashbyhq.com" && first) return `ashby:${first}`;
  if (host === "jobs.smartrecruiters.com" && first) return `smartrecruiters:${first}`;
  if (host === "apply.workable.com" && first) return `workable:${first}`;
  if (host.endsWith(".teamtailor.com")) return `teamtailor:${host}`;
  if (host.endsWith(".myworkdayjobs.com") && first) return `workday:${host.replace(".myworkdayjobs.com", "")}.${first}`;
  for (const [suffix, source] of [[".recruitee.com", "recruitee"], [".breezy.hr", "breezy"], [".bamboohr.com", "bamboohr"], [".hiringroom.com", "hiringroom"]] as const) {
    const s = sub(suffix);
    if (s && !s.includes(".")) return `${source}:${s}`;
  }
  return null;
}

/** Hosts que no identifican a la empresa (ATS, redes, buscadores, documentos). */
const NOT_COMPANY = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|workable\.com|teamtailor\.com|myworkdayjobs\.com|recruitee\.com|breezy\.hr|bamboohr\.com|hiringroom\.com|eightfold\.ai|linkedin\.com|indeed\.com|glassdoor\.com|google\.com|docs\.google\.com|notion\.site|notion\.so|wellfound\.com|ycombinator\.com|crunchbase\.com|bit\.ly|github\.com|medium\.com|computrabajo\.com|bumeran\.com\.ar|zonajobs\.com\.ar|getonbrd\.com)$/;

/** Prefijos que no forman parte del dominio de la empresa ("careers.humand.co" → "humand.co"). */
const SUBDOMAIN = /^(www|careers|career|jobs|job|empleos|trabajos|work|apply|join|talent|carreras|trabaja|trabajaconnosotros)\./;

export function domainFromUrl(raw: string | undefined | null): string | null {
  const u = parseUrl(raw);
  if (!u) return null;
  let host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /^\d+(\.\d+){3}$/.test(host) || NOT_COMPANY.test(host)) return null;
  while (SUBDOMAIN.test(host) && host.split(".").length > 2) host = host.replace(SUBDOMAIN, "");
  return host;
}

/** Dominio escrito a mano ("anthropic.com", "https://www.anthropic.com/"). */
export function normalizeDomain(raw: string | undefined | null): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  return domainFromUrl(/^https?:\/\//i.test(s) ? s : `https://${s}`);
}

export function parseUrl(raw: string | undefined | null): URL | null {
  const s = (raw ?? "").trim();
  if (!s || s.length > 600) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

/** URL utilizable para mostrar como link (sólo http/https). */
export function safeHref(raw: string | undefined | null): string | null {
  return parseUrl(raw)?.toString() ?? null;
}

export function nameKey(name: string): string {
  return companyKey(name);
}

export type Identity = { id: string; identity: IdentityKind; domain?: string; board?: string; nameKey: string };

/**
 * Prioridad de la identidad: dominio (la empresa misma) > bolsa de ATS > nombre.
 * Dos filas con el mismo dominio o la misma bolsa son la misma empresa; por nombre sólo si ninguna tiene dominio ni bolsa distintos.
 */
export function identify(input: { name: string; careersUrl?: string; domain?: string }): Identity {
  const domain = normalizeDomain(input.domain) ?? domainFromUrl(input.careersUrl) ?? undefined;
  const board = boardFromUrl(input.careersUrl) ?? undefined;
  const key = nameKey(input.name);
  if (domain) return { id: `dom:${domain}`, identity: "dominio", domain, board, nameKey: key };
  if (board) return { id: `ats:${board}`, identity: "ats", board, nameKey: key };
  return { id: `nom:${key}`, identity: "nombre", nameKey: key };
}

/** ¿Son la misma empresa? Nunca fusiona dos dominios o dos bolsas distintas sólo por el nombre. */
export function sameCompany(a: Omit<Identity, "id" | "identity">, b: Omit<Identity, "id" | "identity">): boolean {
  if (a.domain && b.domain) return a.domain === b.domain;
  if (a.board && b.board && a.board === b.board) return true;
  if (a.board && b.board) return false;
  if (a.domain && b.board && !b.domain) return a.nameKey === b.nameKey && !!a.nameKey;
  if (b.domain && a.board && !a.domain) return a.nameKey === b.nameKey && !!a.nameKey;
  return !!a.nameKey && a.nameKey === b.nameKey;
}

/** Monograma para el logo de la empresa. */
export function monogram(name: string): string {
  const clean = name.trim().replace(/^the\s+/i, "");
  return (clean.match(/[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/)?.[0] ?? "?").toUpperCase();
}
