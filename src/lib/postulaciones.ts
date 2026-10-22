import { jobKey } from "./jobKey";
import { load, save } from "./storage";

/**
 * Postulaciones armadas en Maru, guardadas sólo en este navegador y por vacante, para que la extensión
 * de Chrome use el CV personalizado y la motivación al completar ese formulario. No viajan al servidor:
 * la extensión las lee desde la pestaña de Maru (extension/bridge.js).
 */
export const POSTULACIONES_KEY = "maru:postulaciones:v1";
/** Aviso a la extensión de que cambió la lista (el puente vuelve a leerla). */
export const POSTULACIONES_EVENT = "maru:postulaciones";
const MAX = 10;

export type SavedPostulacion = {
  key: string;
  jobUrl: string;
  company: string;
  title: string;
  /** Nombre de la persona, para el nombre del archivo. */
  nombre: string;
  /** Por qué le interesa la vacante, tal como lo escribió. */
  motivacion: string;
  /** Respuestas sugeridas para el formulario que ya generó Maru. */
  respuestas: { pregunta: string; respuesta: string }[];
  /** El CV personalizado listo para imprimir (el mismo HTML que se usa para descargar el PDF). */
  cvHtml?: string;
  padY?: number;
  updatedAt: number;
};

export function listPostulaciones(): SavedPostulacion[] {
  const list = load<SavedPostulacion[]>(POSTULACIONES_KEY);
  return Array.isArray(list) ? list : [];
}

/** Guarda (o reemplaza) la postulación de una vacante. Sin URL no hay cómo encontrarla desde la extensión. */
export function savePostulacion(entry: Omit<SavedPostulacion, "key" | "updatedAt">, now = Date.now()): SavedPostulacion | null {
  const key = jobKey(entry.jobUrl);
  if (!key) return null;
  const item: SavedPostulacion = { ...entry, key, updatedAt: now };
  const rest = listPostulaciones().filter((p) => p.key !== key);
  save(POSTULACIONES_KEY, [item, ...rest].slice(0, MAX));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(POSTULACIONES_EVENT));
  return item;
}

export const findPostulacion = (url: string, list = listPostulaciones()) => {
  const key = jobKey(url);
  return key ? list.find((p) => p.key === key) ?? null : null;
};
