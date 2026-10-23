import type { Profile } from "../schemas";
import { findSkills, seniorityFromTitle } from "./extract";
import type { MatchProfile, Seniority } from "./types";

/**
 * Perfil para el match a partir del perfil que Maru ya extrae del CV (/api/profile).
 * Sólo usa datos profesionales: nunca edad, foto, género ni otros atributos personales.
 * Es puro (corre en el navegador): la persona lo confirma y edita antes de ver el ranking.
 */

function parseYm(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (/actual|presente|present|current|hoy/.test(t)) return Date.now();
  const m = t.match(/(?:(\d{1,2})\/)?(\d{4})/);
  if (!m) return null;
  const month = m[1] ? Math.min(12, Math.max(1, Number(m[1]))) : 1;
  return new Date(Number(m[2]), month - 1, 1).getTime();
}

/** Años de experiencia sin contar dos veces los períodos superpuestos. */
export function yearsOfExperience(exp: Profile["experiencia"]): number | null {
  const ranges = exp
    .map((e) => [parseYm(e.inicio), parseYm(e.fin || "actual")] as const)
    .filter((r): r is readonly [number, number] => r[0] !== null && r[1] !== null && r[1] >= r[0])
    .sort((a, b) => a[0] - b[0]);
  if (!ranges.length) return null;
  let total = 0;
  let [cs, ce] = ranges[0];
  for (const [s, e] of ranges.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else {
      total += ce - cs;
      [cs, ce] = [s, e];
    }
  }
  total += ce - cs;
  return Math.round((total / (365.25 * 86_400_000)) * 10) / 10;
}

/**
 * Una aptitud del CV puede ser un párrafo ("Marketing digital: Google Ads, CRO, retención").
 * La partimos en habilidades sueltas: sin el rótulo y por comas fuera de paréntesis.
 */
export function splitSkill(raw: string): string[] {
  const s = raw.trim();
  if (s.length <= 40) return s ? [s] : [];
  const body = s.replace(/^[^:()]{2,60}:\s*/, "");
  return body
    .split(/[,;](?![^(]*\))/)
    .map((x) => x.trim().replace(/[.\s]+$/, ""))
    .filter((x) => x.length > 1)
    .map((x) => x.slice(0, 80));
}

const TEAM_NUM = /(?:(?:equipo|team|area|área)s?\s+(?:de\s+|of\s+)?(?:m[aá]s de\s+|over\s+|more than\s+)?(\d{1,5})\s*\+?)|(?:(\d{1,5})\s*\+?\s*(?:personas|people|colaboradores|direct reports|reportes|reports|members|miembros|empleados|employees|FTEs?)\b)/i;
const LEAD_PHRASE = /\b(p&l|presupuesto|budget|lider[eé]|lideré|liderando|led|managed|gestion[eé]|a cargo de|direct reports|reportes directos|cofund|co-?found)/i;

/** Liderazgo demostrado: equipo más grande mencionado y hasta tres frases que lo respaldan. */
export function leadershipFrom(p: Pick<Profile, "resumen" | "experiencia">): MatchProfile["leadership"] {
  const lines = [p.resumen, ...p.experiencia.flatMap((e) => [e.descripcion, ...e.logros])]
    .flatMap((t) => t.split(/(?<=[.;])\s+|\n+/))
    .map((t) => t.trim())
    .filter(Boolean);
  let teamSize: number | null = null;
  const evidence: string[] = [];
  for (const line of lines) {
    const m = line.match(TEAM_NUM);
    const n = m ? Number(m[1] ?? m[2]) : NaN;
    // Un número de equipo razonable; "equipo de 2025" o un año no cuentan.
    const isTeam = Number.isFinite(n) && n >= 2 && n < 5000 && LEAD_PHRASE.test(line);
    if (isTeam) teamSize = Math.max(teamSize ?? 0, n);
    if ((isTeam || /\b(p&l|presupuesto|budget)\b/i.test(line)) && evidence.length < 3) evidence.push(line.slice(0, 200));
  }
  return teamSize === null && !evidence.length ? undefined : { teamSize, evidence };
}

export function profileToMatch(p: Profile): MatchProfile {
  const text = [p.titulo, p.resumen, ...p.experiencia.flatMap((e) => [e.cargo, e.descripcion, ...e.logros]), ...p.certificaciones.map((c) => c.nombre)].join("\n");
  const skills = [...new Set([...p.aptitudes.flatMap(splitSkill), ...findSkills(text)])].slice(0, 60);
  const leadership = leadershipFrom(p);
  return {
    headline: p.titulo.slice(0, 200),
    titles: [...new Set(p.experiencia.map((e) => e.cargo.trim().slice(0, 160)).filter(Boolean))].slice(0, 6),
    skills,
    languages: p.idiomas.map((l) => ({ language: l.idioma, level: l.nivel })),
    yearsExperience: yearsOfExperience(p.experiencia),
    location: p.ubicacion,
    summary: p.resumen.slice(0, 600),
    ...(leadership ? { leadership } : {}),
  };
}

/** Seniority estimada: primero el cargo actual, si no, los años de experiencia. */
export function estimateSeniority(m: MatchProfile): Seniority | null {
  const fromTitle = seniorityFromTitle(m.titles[0] || m.headline);
  if (fromTitle) return fromTitle;
  const y = m.yearsExperience;
  if (y === null) return null;
  if (y < 2) return "junior";
  if (y < 5) return "semi_senior";
  // Antigüedad no implica liderazgo de personas ni de especialidad.
  return "senior";
}
