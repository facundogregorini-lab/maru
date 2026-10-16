import { buildCvDoc, cvToText, visible, type CvWriting } from "./cv";
import type { CvContext, CvDoc, Profile } from "./schemas";

export type AtsCheck = { ok: boolean; label: string };
export type AtsReport = { score: number; covered: string[]; missing: string[]; checks: AtsCheck[] };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();
}

/** Un término cuenta como cubierto si aparece completo, o si aparecen todas sus palabras significativas. */
function covers(text: string, keyword: string): boolean {
  const k = norm(keyword);
  if (!k) return true;
  if (` ${text} `.includes(` ${k} `)) return true;
  const words = k.split(" ").filter((w) => w.length > 2);
  return words.length > 1 && words.every((w) => ` ${text} `.includes(` ${w}`));
}

/** Compatibilidad ATS calculada sobre el CV editado: 70% palabras clave, 30% estructura. */
export function atsReport(doc: CvDoc, keywords: string[]): AtsReport {
  const text = norm(cvToText(doc));
  const unique = [...new Map(keywords.map((k) => [norm(k), k])).values()];
  const covered = unique.filter((k) => covers(text, k));
  const missing = unique.filter((k) => !covers(text, k));

  const raw = cvToText(doc);
  const checks: AtsCheck[] = [
    { ok: !!doc.contacto.email && !!doc.contacto.telefono, label: "Email y teléfono visibles" },
    { ok: visible(doc, "experiencia") && doc.experiencia.every((e) => /\d{4}/.test(e.periodo)), label: "Cada experiencia tiene fechas" },
    { ok: visible(doc, "educacion"), label: "Sección de educación" },
    { ok: visible(doc, "habilidades"), label: "Sección de habilidades" },
    { ok: !/\[[^\]]*\]/.test(raw), label: "Sin datos pendientes ni corchetes" },
    { ok: raw.length < 9000, label: "Largo razonable (1-2 páginas)" },
  ];

  const kwScore = unique.length ? covered.length / unique.length : 1;
  const structure = checks.filter((c) => c.ok).length / checks.length;
  return { score: Math.round((kwScore * 0.7 + structure * 0.3) * 100), covered, missing, checks };
}

/** Puntaje ATS del CV tal como llegó (sin la reescritura de Maru), para mostrar el antes y el después. */
export function atsBefore(profile: Profile, ctx: CvContext): number {
  const original: CvWriting = { titular: profile.titulo, resumen: profile.resumen, logros_clave: [], habilidades: profile.aptitudes, experiencias: [] };
  return atsReport(buildCvDoc(profile, original, ctx), ctx.palabrasClave).score;
}
