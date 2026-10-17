import { load, remove, save, STORAGE_EVENT } from "../storage";
import { TRACKER_EVENT } from "../tracker";
import { SYNC_DOCS, SYNC_DOC_IDS, docForKey, mergeDoc, type StoredDoc, type SyncDoc } from "./docs";

/** Caché local + versiones del servidor. PUT condicional, una subida por documento y por sesión. */
const META_KEY = "maru:sync:v1";
export const SYNC_EVENT = "maru:sync";
type Meta = {
  email?: string;
  last: Partial<Record<SyncDoc, number>>;
  base: Partial<Record<SyncDoc, unknown>>;
  dirty: Partial<Record<SyncDoc, boolean>>;
};
const PUSH_DELAY_MS = 1500;
const PULL_EVERY_MS = 30_000;
let email: string | null = null;
let generation = 0;
let applying = false;
let installed = false;
let lastPull = 0;
let pulling: Promise<void> | null = null;
let ready = false;
const timers = new Map<SyncDoc, ReturnType<typeof setTimeout>>();
const pushing = new Map<SyncDoc, number>();
const revisions = new Map<SyncDoc, number>();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function readMeta(): Meta {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    const m = raw ? JSON.parse(raw) as Partial<Meta> : {};
    return { email: m.email, last: m.last ?? {}, base: m.base ?? {}, dirty: m.dirty ?? {} };
  } catch { return { last: {}, base: {}, dirty: {} }; }
}
function writeMeta(m: Meta): void {
  try { window.localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* se vuelve a conciliar al ingresar */ }
}
function applyLocal(doc: SyncDoc, data: unknown): void {
  if (same(load(SYNC_DOCS[doc]), data ?? null)) return;
  applying = true;
  try {
    if (data == null) remove(SYNC_DOCS[doc]);
    else save(SYNC_DOCS[doc], data);
  } finally { applying = false; }
  if (doc === "tracker") window.dispatchEvent(new Event(TRACKER_EVENT));
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { doc } }));
}
function acknowledge(m: Meta, doc: SyncDoc, remote: StoredDoc | null): void {
  m.last[doc] = remote?.updatedAt ?? 0;
  m.base[doc] = remote?.data ?? null;
}
/**
 * Un borrado remoto con versión prevalece sobre una copia vieja con cambios pendientes.
 * Lo que se armó en este navegador antes de ingresar por primera vez no es una copia vieja: se conserva.
 */
function reconcile(doc: SyncDoc, local: unknown, remote: StoredDoc | null, base: unknown, firstTime = false): unknown {
  if (local === null) return null;
  if (remote?.data === null) return firstTime ? local : null;
  return mergeDoc(doc, local, remote?.data ?? null, base);
}
async function push(doc: SyncDoc): Promise<void> {
  timers.delete(doc);
  if (!email || !ready) return;
  const gen = generation;
  if (pushing.get(doc) === gen) { schedule(doc); return; }
  pushing.set(doc, gen);
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (generation !== gen) return;
      const m = readMeta();
      if (!m.dirty[doc]) return;
      const data = load(SYNC_DOCS[doc]);
      const revision = revisions.get(doc) ?? 0;
      const res = await fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Maru-Account": email! },
        body: JSON.stringify({ doc, data, baseVersion: m.last[doc] ?? 0 }),
        keepalive: data == null,
      });
      if (generation !== gen) return;
      if (res.status === 409) {
        const { current } = await res.json() as { current: StoredDoc | null };
        if (generation !== gen) return;
        const next = readMeta();
        applyLocal(doc, reconcile(doc, load(SYNC_DOCS[doc]), current, next.base[doc]));
        acknowledge(next, doc, current);
        next.dirty[doc] = !same(load(SYNC_DOCS[doc]), current?.data ?? null);
        writeMeta(next);
        continue;
      }
      if (!res.ok) return;
      const stored = await res.json() as StoredDoc;
      if (generation !== gen) return;
      const next = readMeta();
      acknowledge(next, doc, stored);
      next.dirty[doc] = revision !== (revisions.get(doc) ?? 0) || !same(load(SYNC_DOCS[doc]), data);
      writeMeta(next);
      if (!next.dirty[doc]) return;
    }
  } catch { /* queda pendiente para reintentar */ }
  finally {
    if (pushing.get(doc) === gen) pushing.delete(doc);
  }
}
function schedule(doc: SyncDoc, delay = PUSH_DELAY_MS): void {
  clearTimeout(timers.get(doc));
  timers.set(doc, setTimeout(() => void push(doc), delay));
}
function onLocalChange(e: Event): void {
  if (applying) return;
  const doc = docForKey((e as CustomEvent<{ key: string }>).detail?.key ?? "");
  if (!doc) return;
  revisions.set(doc, (revisions.get(doc) ?? 0) + 1);
  const m = readMeta();
  if (!m.email) return;
  m.dirty[doc] = true;
  writeMeta(m);
  if (email === m.email && ready) schedule(doc, load(SYNC_DOCS[doc]) == null ? 0 : PUSH_DELAY_MS);
}
function onFocus(): void {
  if (document.visibilityState === "visible" && email && Date.now() - lastPull > PULL_EVERY_MS) void pull();
}
async function pull(): Promise<void> {
  if (pulling) return pulling;
  const gen = generation;
  const operation = (async () => {
    if (!email) return;
    lastPull = Date.now();
    try {
      const res = await fetch("/api/sync", { cache: "no-store", headers: { "X-Maru-Account": email } });
      if (!res.ok) return;
      const body = await res.json() as { configured: boolean; docs: Partial<Record<SyncDoc, StoredDoc | null>> };
      if (!body.configured || generation !== gen) return;
      const m = readMeta();
      const firstTime = !m.email;
      m.email = email;
      for (const doc of SYNC_DOC_IDS) {
        // Una subida en curso ya maneja sus propios conflictos. No aplicar una lectura anterior.
        if (pushing.get(doc) === gen) continue;
        const remote = body.docs[doc] ?? null;
        const local = load(SYNC_DOCS[doc]);
        const dirty = firstTime ? local != null : !!m.dirty[doc];
        if (dirty) {
          const changedRemote = (remote?.updatedAt ?? 0) !== (m.last[doc] ?? 0);
          if (changedRemote) applyLocal(doc, reconcile(doc, local, remote, m.base[doc], firstTime));
          acknowledge(m, doc, remote);
          m.dirty[doc] = !same(load(SYNC_DOCS[doc]), remote?.data ?? null);
        } else {
          applyLocal(doc, remote?.data ?? null);
          acknowledge(m, doc, remote);
          m.dirty[doc] = false;
        }
      }
      writeMeta(m);
      ready = true;
      for (const doc of SYNC_DOC_IDS) if (m.dirty[doc]) schedule(doc, 0);
    } catch { /* la caché sigue disponible */ }
  })();
  pulling = operation;
  try { await operation; } finally { if (pulling === operation) pulling = null; }
}
export function setSyncAccount(next: string | null): void {
  if (typeof window === "undefined") return;
  if (!installed) {
    installed = true;
    window.addEventListener(STORAGE_EVENT, onLocalChange);
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === META_KEY || (e.key && docForKey(e.key))) { lastPull = 0; onFocus(); }
    });
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
  }
  if (next === email) return;
  generation++;
  email = next;
  ready = false;
  pulling = null;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  pushing.clear();
  const m = readMeta();
  if (next && m.email && m.email !== next) {
    // Vaciar antes de cualquier petición; incluso si la red falla, la nueva cuenta no ve la anterior.
    for (const doc of SYNC_DOC_IDS) applyLocal(doc, null);
    applying = true;
    try {
      for (const key of ["maru:sesion:v2", "maru:cv:v1", "maru:carta:v1", "maru:entrevista:v1", "maru:video:v1", "maru:handoff:postulacion"]) remove(key);
    } finally { applying = false; }
    writeMeta({ email: next, last: {}, base: {}, dirty: {} });
  }
  if (email) void pull();
}

/** Borrado explícito: sólo confirma éxito cuando el servidor acusó los tres documentos. */
export async function forgetAccountData(): Promise<void> {
  if (!email) return;
  if (!ready) await pull();
  if (!ready) throw new Error("No pudimos conectar con tu cuenta. El borrado local quedó pendiente de sincronización.");
  for (const doc of SYNC_DOC_IDS) {
    remove(SYNC_DOCS[doc]);
    if (doc === "tracker") window.dispatchEvent(new Event(TRACKER_EVENT));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { doc } }));
    await push(doc);
    if (readMeta().dirty[doc]) throw new Error("Borramos este navegador, pero no pudimos confirmar el borrado de tu cuenta. Volvé a intentar cuando tengas conexión.");
  }
}
