import type { Criterion, CriterionId, EligibilityStatus, MatchWeights, Priority, RadarMatch } from "../types";

/**
 * Composición del score de radar-match (ADR-002). Puro y sin red: lo usan el motor, la pantalla y los tests.
 * Sólo los criterios conocidos cuentan; se renormaliza sobre sus pesos y se informa la cobertura.
 */

export const SCORING_VERSION = "radar-match@1";

export const CRITERIA: { id: CriterionId; label: string; weightKey: keyof MatchWeights }[] = [
  { id: "experiencia", label: "Experiencia y competencias", weightKey: "experiencia" },
  { id: "seniority", label: "Seniority y alcance", weightKey: "seniority" },
  { id: "ubicacion", label: "Ubicación y elegibilidad", weightKey: "ubicacion" },
  { id: "compensacion", label: "Compensación", weightKey: "compensacion" },
  { id: "interes", label: "Interés por la empresa", weightKey: "interes" },
];

export type CriterionInput = Partial<Record<CriterionId, { score: number | null; evidence: string[] }>>;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function compose(inputs: CriterionInput, weights: MatchWeights, method: RadarMatch["method"]): { score: number | null; coverage: number; confidence: RadarMatch["confidence"]; breakdown: Criterion[] } {
  const breakdown: Criterion[] = CRITERIA.map(({ id, weightKey }) => {
    const c = inputs[id];
    const known = !!c && c.score !== null && Number.isFinite(c.score);
    return { id, known, score: known ? clamp(c!.score!) : null, weight: weights[weightKey], evidence: (c?.evidence ?? []).slice(0, 4) };
  });
  const knownW = breakdown.filter((c) => c.known).reduce((a, c) => a + c.weight, 0);
  const total = breakdown.reduce((a, c) => a + c.weight, 0) || 100;
  const coverage = Math.round((knownW / total) * 100) / 100;
  const score = knownW ? clamp(breakdown.filter((c) => c.known).reduce((a, c) => a + c.weight * c.score!, 0) / knownW) : null;
  const confidence: RadarMatch["confidence"] = coverage >= 0.8 && method === "ia" ? "alta" : coverage >= 0.6 ? "media" : "baja";
  return { score, coverage, confidence, breakdown };
}

export const PRIORITY_INTEREST: Record<string, number> = { P1: 100, P2: 70, P3: 40, null: 50 };
const PRIORITY_ACTION: Record<string, number> = { P1: 100, P2: 60, P3: 20, null: 20 };

export function novelty(publishedAt: string | null, firstSeenAt: string, now = Date.now()): number {
  const days = (now - Date.parse(publishedAt ?? firstSeenAt)) / 86_400_000;
  return days <= 3 ? 100 : days <= 7 ? 60 : 20;
}

export type ActionBand = "alta" | "media" | "baja";

/**
 * Prioridad de acción: a·match + c·prioridad de empresa + 0,05·novedad, después de los gates.
 * c baja cuanto más pesa el interés por la empresa dentro del match (para no contarlo dos veces).
 * Es una heurística para ordenar, no una probabilidad.
 */
export function actionPriority(
  m: Pick<RadarMatch, "score" | "eligibility" | "confidence"> & { rejected?: string | null },
  ctx: { priority: Priority | null; publishedAt: string | null; firstSeenAt: string; open: boolean; interestWeight: number; now?: number },
): { value: number; band: ActionBand; why: string[] } | null {
  if (!ctx.open || m.score === null || m.eligibility === "blocked" || m.rejected) return null;
  const c = Math.max(0, 0.1 - (0.85 * ctx.interestWeight) / 100);
  const a = 0.95 - c;
  const nov = novelty(ctx.publishedAt, ctx.firstSeenAt, ctx.now);
  let value = a * m.score + c * PRIORITY_ACTION[String(ctx.priority)] + 0.05 * nov;
  const why = [`Match ${m.score}/100`, `Empresa ${ctx.priority ?? "sin clasificar"}`, nov === 100 ? "Publicada hace 3 días o menos" : nov === 60 ? "Publicada esta semana" : "Publicada hace más de una semana"];
  if (m.eligibility === "needs_verification") {
    value = Math.min(value, 69);
    why.push("Falta verificar la elegibilidad");
  }
  if (m.confidence === "baja") {
    value = Math.min(value, 59);
    why.push("Poca información para evaluar");
  }
  const v = Math.round(value);
  return { value: v, band: v >= 75 ? "alta" : v >= 55 ? "media" : "baja", why };
}

export const ELIGIBILITY_LABEL: Record<EligibilityStatus, string> = { eligible: "Elegible", needs_verification: "Por verificar", blocked: "Bloqueada" };
