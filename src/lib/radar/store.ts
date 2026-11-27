import { load, remove, save } from "../storage";
import { normalizeState } from "./state";
import { RADAR_EVENT, RADAR_KEY, type RadarState } from "./types";

/** El Radar en este navegador. Con sesión, src/lib/sync lo copia a la cuenta (documento "radar"). */

export function loadRadar(): RadarState {
  return normalizeState(load<unknown>(RADAR_KEY));
}

export function saveRadar(s: RadarState): void {
  save(RADAR_KEY, s);
  try {
    window.dispatchEvent(new Event(RADAR_EVENT));
  } catch {
    // sin window
  }
}

export function forgetRadar(): void {
  remove(RADAR_KEY);
}
