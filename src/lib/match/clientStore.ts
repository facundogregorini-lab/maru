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

export type Handoff = { jobUrl: string; jobText: string; title: string; company: string; at: number };

/** "Preparar mi postulación": deja la búsqueda lista para el coach de postulación. */
export function handoffToPostulacion(h: Omit<Handoff, "at">): void {
  save(HANDOFF_KEY, { ...h, at: Date.now() } satisfies Handoff);
}

export function takeHandoff(maxAgeMs = 60 * 60_000): Handoff | null {
  const h = load<Handoff>(HANDOFF_KEY);
  remove(HANDOFF_KEY);
  return h && Date.now() - h.at < maxAgeMs ? h : null;
}
