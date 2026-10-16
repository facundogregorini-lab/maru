import { forgetProfile } from "../profileStore";
import { load, remove, save } from "../storage";
import type { ExternalJob } from "./api-schemas";
import type { Interactions, MatchPrefs, MatchProfile } from "./types";

/**
 * Datos personales del match: viven sólo en este navegador, como el resto de Maru.
 * El servidor los recibe para ordenar el ranking y no los guarda.
 */

const KEY = "maru:match:v1";
export const HANDOFF_KEY = "maru:handoff:postulacion";

export type MatchState = {
  profile: MatchProfile | null;
  prefs: MatchPrefs | null;
  interactions: Interactions;
  external: ExternalJob[];
  updatedAt: number;
};

export const EMPTY_STATE: MatchState = { profile: null, prefs: null, interactions: { saved: [], discarded: [] }, external: [], updatedAt: 0 };

export function loadMatch(): MatchState {
  const s = load<MatchState>(KEY);
  return s ? { ...EMPTY_STATE, ...s, interactions: { ...EMPTY_STATE.interactions, ...s.interactions } } : EMPTY_STATE;
}

export function saveMatch(s: MatchState): void {
  save(KEY, { ...s, updatedAt: Date.now() });
}

/** Borra perfil, preferencias, guardados, descartes y búsquedas propias (y el CV leído por Maru). */
export function forgetEverything(): void {
  remove(KEY);
  remove(HANDOFF_KEY);
  forgetProfile();
}

export type HandoffTarget = "postulacion" | "carta" | "entrevista" | "video";
export type Handoff = { id?: string; jobUrl: string; jobText: string; title: string; company: string; at: number; to?: HandoffTarget };

/** Deja una búsqueda lista para otra herramienta (postulación, carta, entrevista o video). */
export function handoffJob(to: HandoffTarget, h: Omit<Handoff, "at" | "to">): void {
  save(HANDOFF_KEY, { ...h, to, at: Date.now() } satisfies Handoff);
}

/** "Preparar mi postulación": deja la búsqueda lista para el coach de postulación. */
export function handoffToPostulacion(h: Omit<Handoff, "at" | "to">): void {
  handoffJob("postulacion", h);
}

/** Toma la búsqueda que dejaron para esta herramienta (y sólo para esta). */
export function takeHandoff(to: HandoffTarget = "postulacion", maxAgeMs = 60 * 60_000): Handoff | null {
  const h = load<Handoff>(HANDOFF_KEY);
  if (!h || (h.to ?? "postulacion") !== to) return null;
  remove(HANDOFF_KEY);
  return Date.now() - h.at < maxAgeMs ? h : null;
}
