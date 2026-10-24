import { linkedinJobId } from "./apify";
import type { RankedItem, RankOutput } from "./ranking";
import { sourceById } from "./sources";
import type { StoredPosting } from "./types";

/**
 * Oportunidades ocultas: búsquedas que leímos directo del sitio de empleos (ATS) de la empresa y que no
 * vimos publicadas en LinkedIn. No afirmamos que no estén en LinkedIn: sólo que nosotros no las encontramos ahí.
 */

/** Posiciones de «Para vos» (desde 0) donde el plan gratis ve una oculta difuminada: la 2 y la 4. */
export const TEASER_POSITIONS = [1, 3];

const LINKEDIN_SOURCES = new Set(["apify-linkedin", "fantastic_jb"]);
const LINKEDIN_URL = /(^|\/\/|\.)linkedin\.com\//i;

const fromLinkedin = (p: StoredPosting) =>
  LINKEDIN_SOURCES.has(p.sourceId) || LINKEDIN_URL.test(p.sourceUrl) || LINKEDIN_URL.test(p.applyUrl) || !!linkedinJobId(p.sourceUrl);
/** El ATS del empleador, leído directo o por el índice de Fantastic.jobs de sitios de empresas. */
const fromEmployerAts = (p: StoredPosting) => p.sourceId === "fantastic_ats" || sourceById(p.sourceId)?.kind === "ats";

/** true si todas las publicaciones vienen del ATS de la empresa y ninguna de LinkedIn. */
export function isHiddenOpportunity(posts: StoredPosting[]): boolean {
  return posts.length > 0 && posts.every((p) => fromEmployerAts(p) && !fromLinkedin(p));
}

/** Lo único que viaja de una oculta difuminada: la compatibilidad. */
export type HiddenTeaser = { score: number };
/**
 * Con plan: `items` trae las ocultas de todo el ranking (pestaña «Ocultas»).
 * Sin plan: `items` vacío y `teasers` con el % de las 2 mejores, para difuminarlas en «Para vos».
 */
export type HiddenSection = { items: RankedItem[]; teasers: HiddenTeaser[]; total: number; full: boolean };

/**
 * Arma la sección de ocultas del ranking ya ordenado. Con el plan gratis, el ranking ya las dejó afuera de las listas
 * (`excludeHidden`); acá se descartan igual por las dudas y nunca viaja nada más que el porcentaje.
 */
export function withHiddenSection<T extends RankOutput>(r: T, paid: boolean): Omit<T, "hiddenPool"> & { hidden: HiddenSection } {
  const { hiddenPool, ...rest } = r;
  const all = hiddenPool ?? [...r.eligible, ...r.pending].filter((i) => i.hidden);
  const total = Math.max(r.counts.hidden ?? 0, all.length);
  if (paid) return { ...rest, hidden: { items: all, teasers: [], total, full: true } };

  const visible = (xs: RankedItem[]) => xs.filter((i) => !i.hidden);
  const eligible = visible(r.eligible);
  const pending = visible(r.pending);
  return {
    ...rest,
    eligible,
    pending,
    saved: visible(r.saved),
    counts: {
      ...r.counts,
      eligible: r.counts.eligible - (r.eligible.length - eligible.length),
      pending: r.counts.pending - (r.pending.length - pending.length),
      shown: eligible.length + pending.length,
    },
    hidden: { items: [], teasers: all.slice(0, TEASER_POSITIONS.length).map((i) => ({ score: i.score })), total, full: false },
  };
}
