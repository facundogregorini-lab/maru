import { normalizeUrl, trackId, type TrackInput, type TrackItem } from "../tracker";

/**
 * Radar ↔ Seguimiento, con el modelo existente (src/lib/tracker.ts): guardar una vacante crea o actualiza UNA
 * tarjeta (misma URL = misma tarjeta) en estado «guardada». Nunca postula ni cambia a «postulada».
 * El estado que muestra Radar se lee de Seguimiento, así queda sincronizado en los dos sentidos.
 */

export type RadarJobRef = { url: string; title: string; companyName: string };

export function trackInputFor(job: RadarJobRef): TrackInput {
  return { title: job.title, company: job.companyName, jobUrl: job.url, status: "guardada" };
}

export function trackedFor(items: TrackItem[], job: RadarJobRef): TrackItem | null {
  const url = normalizeUrl(job.url);
  const id = trackId({ jobUrl: job.url, title: job.title, company: job.companyName });
  return items.find((it) => it.id === id || (!!url && normalizeUrl(it.jobUrl) === url)) ?? null;
}
