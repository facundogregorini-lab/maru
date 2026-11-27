import { redisRepos } from "./redis";
import type { RadarRepos } from "./types";

export type * from "./types";

let override: RadarRepos | null = null;

/** Los repositorios de Radar. Hoy, Upstash (o la memoria de db.ts en desarrollo y tests). */
export const radarRepos = (): RadarRepos => override ?? redisRepos;

/** Para tests: otra implementación. */
export function setRadarRepos(r: RadarRepos | null) {
  override = r;
}
