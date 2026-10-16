import type { SavedProfile } from "../profileStore";
import type { MatchState } from "../match/clientStore";
import type { TrackItem } from "../tracker";

/**
 * Lo que se sincroniza con la cuenta: el perfil, el match (preferencias y búsquedas guardadas o descartadas)
 * y el seguimiento. Cada documento es la misma clave de localStorage que ya usaba Maru, tal cual.
 * Lo armado en cada herramienta (CV, carta, entrevista, video) sigue siendo sólo del navegador.
 */

export const SYNC_DOCS = {
  perfil: "maru:perfil:v1",
  match: "maru:match:v1",
  tracker: "maru:tracker:v1",
} as const;

export type SyncDoc = keyof typeof SYNC_DOCS;
export const SYNC_DOC_IDS = Object.keys(SYNC_DOCS) as SyncDoc[];

/** Lo que guarda el servidor por documento. data null = borrado (queda la marca para que los demás dispositivos también lo borren). */
export type StoredDoc = { data: unknown; updatedAt: number };

/** Tope por documento (JSON). Un seguimiento con cientos de avisos completos entra holgado. */
export const MAX_DOC_BYTES = 2_000_000;

export const isSyncDoc = (x: unknown): x is SyncDoc => typeof x === "string" && Object.hasOwn(SYNC_DOCS, x);

export function docForKey(key: string): SyncDoc | null {
  return SYNC_DOC_IDS.find((d) => SYNC_DOCS[d] === key) ?? null;
}

/** Forma mínima de cada documento: lo justo para no guardar cualquier cosa. */
export function validDocData(doc: SyncDoc, data: unknown): boolean {
  if (data === null) return true;
  if (doc === "tracker") return Array.isArray(data) && data.every((it) => it && typeof it === "object" && typeof (it as TrackItem).id === "string");
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (doc === "perfil") return typeof (data as SavedProfile).profile === "object";
  return true;
}

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/**
 * Junta lo de este navegador con lo de la cuenta cuando los dos cambiaron desde la última sincronización
 * (o la primera vez que se ingresa desde un navegador que ya tenía datos).
 * - Seguimiento: unión por tarjeta; si está en los dos, gana la editada más tarde.
 * - Perfil: el más reciente.
 * - Match: el más reciente, sumando las búsquedas guardadas y descartadas de los dos.
 */
export function mergeDoc(doc: SyncDoc, local: unknown, remote: unknown, base?: unknown): unknown {
  if (local == null) return remote;
  if (remote == null) return local;

  if (doc === "tracker") {
    const byId = new Map<string, TrackItem>();
    const baseIds = new Set(((base ?? []) as TrackItem[]).map((it) => it.id));
    const localIds = new Set((local as TrackItem[]).map((it) => it.id));
    const remoteIds = new Set((remote as TrackItem[]).map((it) => it.id));
    for (const it of [...(remote as TrackItem[]), ...(local as TrackItem[])]) {
      // Si estaba en la base común y falta en un lado, fue borrada. No resucitarla.
      if (baseIds.has(it.id) && (!localIds.has(it.id) || !remoteIds.has(it.id))) continue;
      const prev = byId.get(it.id);
      if (!prev || num(it.updatedAt) >= num(prev.updatedAt)) byId.set(it.id, it);
    }
    return [...byId.values()];
  }

  if (doc === "perfil") {
    const l = local as SavedProfile;
    const r = remote as SavedProfile;
    return num(l.savedAt) >= num(r.savedAt) ? l : r;
  }

  const l = local as MatchState;
  const r = remote as MatchState;
  const [newer, older] = num(l.updatedAt) >= num(r.updatedAt) ? [l, r] : [r, l];
  const original = base as MatchState | undefined;
  const baseSaved = new Set(original?.interactions?.saved ?? []);
  const baseDiscarded = new Set((original?.interactions?.discarded ?? []).map((d) => d.id));
  const localSaved = new Set(l.interactions?.saved ?? []);
  const remoteSaved = new Set(r.interactions?.saved ?? []);
  const saved = [...new Set([...(newer.interactions?.saved ?? []), ...(older.interactions?.saved ?? [])])].filter((id) => !baseSaved.has(id) || (localSaved.has(id) && remoteSaved.has(id)));
  const discarded = [...(newer.interactions?.discarded ?? [])];
  for (const d of older.interactions?.discarded ?? []) if (!discarded.some((x) => x.id === d.id)) discarded.push(d);
  // Lo que la versión nueva tiene descartado no vuelve a guardadas, y viceversa.
  const newerSaved = new Set(newer.interactions?.saved ?? []);
  return {
    ...newer,
    interactions: {
      saved: saved.filter((id) => newerSaved.has(id) || !discarded.some((d) => d.id === id)),
      discarded: discarded.filter((d) => !newerSaved.has(d.id) && (!baseDiscarded.has(d.id) || (l.interactions?.discarded?.some((x) => x.id === d.id) && r.interactions?.discarded?.some((x) => x.id === d.id)))),
    },
  };
}
