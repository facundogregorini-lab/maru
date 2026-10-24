import type { RankedItem, RankOutput } from "./ranking";

/**
 * Oportunidades ocultas: búsquedas que leímos del sitio de empleo de la empresa (su ATS) y que no vimos
 * publicadas en LinkedIn. No prueba que no estén en LinkedIn: sólo que ninguna de nuestras fuentes las trajo de ahí.
 * Son del plan pago: a quien no paga, el servidor no le manda sus datos, sólo el porcentaje de dos de ellas.
 */
const LINKEDIN = /linkedin/i;

export function isHidden(item: Pick<RankedItem, "sources" | "external">): boolean {
  if (item.external) return false;
  return item.sources.some((s) => s.kind === "ats") && !item.sources.some((s) => LINKEDIN.test(`${s.name} ${s.url} ${s.applyUrl} ${s.attribution ?? ""}`));
}

/** Dos de las cinco primeras, difuminadas, sólo si el match es fuerte. */
export const TEASER_POSITIONS = [2, 4];
export const TEASER_MIN_SCORE = 70;

export type HiddenInfo = {
  /** true si la persona tiene un plan pago (o el cobro está apagado). */
  unlocked: boolean;
  eligible: number;
  pending: number;
  /** Plan gratis: lugares (desde 1) y porcentaje de las ocultas difuminadas en "Para vos". */
  teaser: { position: number; score: number }[];
};

export type HiddenOutput<T extends RankOutput> = T & { hidden: HiddenInfo; hiddenItems: RankedItem[] };

/**
 * Marca las ocultas (plan pago) o las saca de la respuesta (plan gratis). `before` es el ranking de la primera
 * etapa: sus cuentas cubren todas las abiertas y la IA sólo re-evalúa las que trajo, así que las ocultas que quedaron
 * fuera de esa ventana se cuentan desde ahí.
 */
export function applyHidden<T extends RankOutput>(result: T, before: RankOutput, paid: boolean): HiddenOutput<T> {
  const count = (xs: RankedItem[]) => xs.filter(isHidden).length;
  const eligible = before.counts.hiddenEligible - count(before.eligible) + count(result.eligible);
  const pending = before.counts.hiddenPending - count(before.pending) + count(result.pending);
  if (paid) {
    const mark = (xs: RankedItem[]) => xs.map((x) => (isHidden(x) ? { ...x, hidden: true } : x));
    const marked = { eligible: mark(result.eligible), pending: mark(result.pending) };
    return {
      ...result,
      ...marked,
      hidden: { unlocked: true, eligible, pending, teaser: [] },
      hiddenItems: [...marked.eligible, ...marked.pending].filter((x) => x.hidden),
    };
  }
  const top = result.eligible.filter((x) => isHidden(x) && x.score >= TEASER_MIN_SCORE).slice(0, TEASER_POSITIONS.length);
  return {
    ...result,
    eligible: result.eligible.filter((x) => !isHidden(x)),
    pending: result.pending.filter((x) => !isHidden(x)),
    counts: { ...result.counts, eligible: result.counts.eligible - eligible, pending: result.counts.pending - pending },
    hidden: { unlocked: false, eligible, pending, teaser: top.map((x, i) => ({ position: TEASER_POSITIONS[i], score: x.score })) },
    hiddenItems: [],
  };
}
