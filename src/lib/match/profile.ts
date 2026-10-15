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

export function profileToMatch(p: Profile): MatchProfile {
  const text = [p.titulo, p.resumen, ...p.experiencia.flatMap((e) => [e.cargo, e.descripcion, ...e.logros]), ...p.certificaciones.map((c) => c.nombre)].join("\n");
  const skills = [...new Set([...p.aptitudes.map((s) => s.trim()).filter(Boolean), ...findSkills(text)])].slice(0, 40);
  return {
    headline: p.titulo,
    titles: [...new Set(p.experiencia.map((e) => e.cargo.trim()).filter(Boolean))].slice(0, 6),
    skills,
    languages: p.idiomas.map((l) => ({ language: l.idioma, level: l.nivel })),
    yearsExperience: yearsOfExperience(p.experiencia),
    location: p.ubicacion,
    summary: p.resumen.slice(0, 600),
  };
}

/** Seniority estimada: primero el cargo actual, si no, los años de experiencia. */
export function estimateSeniority(m: MatchProfile): Seniority | null {
  const fromTitle = m.titles[0] ? seniorityFromTitle(m.titles[0]) : null;
  if (fromTitle) return fromTitle;
  const y = m.yearsExperience;
  if (y === null) return null;
  if (y < 2) return "junior";
  if (y < 5) return "semi_senior";
  if (y < 9) return "senior";
  return "lead";
}
