import { linkedinJobId } from "./apify";
import type { RankedItem, RankOutput } from "./ranking";
import { sourceById } from "./sources";
import type { StoredPosting } from "./types";

/**
 * Oportunidades ocultas: búsquedas que leímos directo del sitio de empleos (ATS) de la empresa y que no
 * vimos publicadas en LinkedIn. No afirmamos que no estén en LinkedIn: sólo que nosotros no las encontramos ahí.
 */

/** Índices que aparecen difuminados en el plan gratis (2 de los 5 primeros). */
export const LOCKED_POSITIONS = [1, 3];
/** Cuántas ocultas ve el plan gratis en su sección (incluidas las difuminadas). */
export const FREE_HIDDEN = 5;

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
export type LockedHidden = { locked: true; score: number };
export type HiddenEntry = RankedItem | LockedHidden;
export type HiddenSection = { items: HiddenEntry[]; total: number; full: boolean };

/**
 * Arma la sección «Ocultas» del ranking ya ordenado. Con plan pago van todas. En el plan gratis, de las 5 primeras,
 * 2 quedan difuminadas: el servidor sólo manda su porcentaje y las saca de las demás listas, así no se filtran por otro lado.
 */
export function withHiddenSection<T extends RankOutput>(r: T, paid: boolean): Omit<T, "hiddenPool"> & { hidden: HiddenSection } {
  const { hiddenPool, ...rest } = r;
  const all = hiddenPool ?? [...r.eligible, ...r.pending].filter((i) => i.hidden);
  const total = Math.max(r.counts.hidden ?? 0, all.length);
  if (paid) return { ...rest, hidden: { items: all, total, full: true } };

  const top = all.slice(0, FREE_HIDDEN);
  const lockedIds = new Set(top.filter((_, i) => LOCKED_POSITIONS.includes(i)).map((i) => i.id));
  const items = top.map((i): HiddenEntry => (lockedIds.has(i.id) ? { locked: true, score: i.score } : i));
  const keep = (xs: RankedItem[]) => xs.filter((i) => !lockedIds.has(i.id));
  const eligible = keep(r.eligible);
  const pending = keep(r.pending);
  return {
    ...rest,
    eligible,
    pending,
    saved: keep(r.saved),
    counts: {
      ...r.counts,
      eligible: r.counts.eligible - (r.eligible.length - eligible.length),
      pending: r.counts.pending - (r.pending.length - pending.length),
      shown: eligible.length + pending.length,
    },
    hidden: { items, total, full: false },
  };
}

export const isLocked = (e: HiddenEntry): e is LockedHidden => "locked" in e;
