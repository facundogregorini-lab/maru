import { load, remove, save, STORAGE_EVENT } from "../storage";
import { TRACKER_EVENT } from "../tracker";
import { SYNC_DOCS, SYNC_DOC_IDS, docForKey, mergeDoc, type StoredDoc, type SyncDoc } from "./docs";

/**
 * Sincroniza el perfil, el match y el seguimiento con la cuenta (magic link) para verlos en cualquier dispositivo.
 * localStorage sigue siendo la fuente de la app: esto sólo copia hacia y desde la base.
 *
 * - Cada cambio local marca el documento como pendiente y se sube a los pocos segundos.
 * - Al ingresar, al cargar la página y al volver a la pestaña se baja lo de la cuenta:
 *   si acá no hubo cambios, se toma lo de la cuenta; si cambiaron los dos, se juntan (ver mergeDoc).
 * - Si en este navegador había otra cuenta, no se sube nada suyo a la nueva: se reemplaza por lo de la nueva.
 */

const META_KEY = "maru:sync:v1";
/** Se dispara cuando lo de la cuenta pisó algo de este navegador. */
export const SYNC_EVENT = "maru:sync";

type Meta = {
  /** La última cuenta que sincronizó en este navegador. */
  email?: string;
  /** updatedAt (reloj del servidor) de lo último que se bajó o subió de cada documento. */
  last: Partial<Record<SyncDoc, number>>;
  /** Cambios locales que todavía no llegaron a la cuenta. */
  dirty: Partial<Record<SyncDoc, boolean>>;
};

const PUSH_DELAY_MS = 1500;
const PULL_EVERY_MS = 30_000;

let email: string | null = null;
let applying = false;
let installed = false;
let lastPull = 0;
let pulling: Promise<void> | null = null;
const timers = new Map<SyncDoc, ReturnType<typeof setTimeout>>();

function readMeta(): Meta {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    const m = raw ? (JSON.parse(raw) as Partial<Meta>) : {};
    return { email: m.email, last: m.last ?? {}, dirty: m.dirty ?? {} };
  } catch {
    return { last: {}, dirty: {} };
  }
}

function writeMeta(m: Meta): void {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    // sin acceso: la próxima vez se vuelve a juntar todo
  }
}

/** Escribe en localStorage lo que vino de la cuenta sin marcarlo como cambio local. */
function applyLocal(doc: SyncDoc, data: unknown): void {
  applying = true;
  try {
    if (data == null) remove(SYNC_DOCS[doc]);
    else save(SYNC_DOCS[doc], data);
  } finally {
    applying = false;
  }
  try {
    if (doc === "tracker") window.dispatchEvent(new Event(TRACKER_EVENT));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { doc } }));
  } catch {
    // sin vistas que refrescar
  }
}

async function push(doc: SyncDoc): Promise<void> {
  timers.delete(doc);
  if (!email) return;
  const data = load(SYNC_DOCS[doc]);
  try {
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc, data }),
      keepalive: data == null,
    });
    if (!res.ok) return; // queda pendiente: se reintenta en el próximo cambio o al volver a la pestaña
    const { updatedAt } = (await res.json()) as { updatedAt: number };
    const m = readMeta();
    // Si hubo otro cambio mientras subía, sigue pendiente (ya hay otra subida programada).
    if (!timers.has(doc)) m.dirty[doc] = false;
    m.last[doc] = updatedAt;
    writeMeta(m);
  } catch {
    // sin conexión: queda pendiente
  }
}

function schedule(doc: SyncDoc, delay = PUSH_DELAY_MS): void {
  clearTimeout(timers.get(doc));
  timers.set(
    doc,
    setTimeout(() => void push(doc), delay),
  );
}

function onLocalChange(e: Event): void {
  if (applying) return;
  const doc = docForKey((e as CustomEvent<{ key: string }>).detail?.key ?? "");
  if (!doc) return;
  const m = readMeta();
  // Sin cuenta nunca usada en este navegador no hay nada que marcar: al ingresar se junta todo igual.
  if (!m.email) return;
  m.dirty[doc] = true;
  writeMeta(m);
  // Un borrado ("Borrar mis datos") sale enseguida, por si cierran la pestaña.
  if (email === m.email) schedule(doc, load(SYNC_DOCS[doc]) == null ? 0 : PUSH_DELAY_MS);
}

function onFocus(): void {
  if (document.visibilityState === "visible" && email && Date.now() - lastPull > PULL_EVERY_MS) void pull();
}

async function pull(): Promise<void> {
  if (pulling) return pulling;
  pulling = (async () => {
    const me = email;
    if (!me) return;
    lastPull = Date.now();
    let docs: Partial<Record<SyncDoc, StoredDoc | null>>;
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { configured: boolean; docs: Partial<Record<SyncDoc, StoredDoc | null>> };
      if (!body.configured) return;
      docs = body.docs;
    } catch {
      return;
    }
    if (email !== me) return;

    const m = readMeta();
    const firstTime = !m.email;
    const otherAccount = !!m.email && m.email !== me;
    m.email = me;

    for (const doc of SYNC_DOC_IDS) {
      const remote = docs[doc] ?? null;
      const local = load(SYNC_DOCS[doc]);

      // Otra cuenta en este navegador (una compu compartida): lo de la anterior ya está en su cuenta
      // y no tiene que pasar a esta, así que se reemplaza por lo de la nueva (o se vacía).
      if (otherAccount) {
        if (local != null || remote?.data != null) applyLocal(doc, remote?.data ?? null);
        m.last[doc] = remote?.updatedAt;
        m.dirty[doc] = false;
        continue;
      }

      const dirty = firstTime ? local != null : !!m.dirty[doc];

      if (!remote) {
        m.dirty[doc] = dirty;
        if (dirty) schedule(doc, 0);
        continue;
      }
      if (!dirty) {
        if (remote.updatedAt !== m.last[doc]) applyLocal(doc, remote.data);
        m.last[doc] = remote.updatedAt;
        m.dirty[doc] = false;
        continue;
      }
      // Cambiaron los dos lados: se juntan y se sube el resultado.
      if (remote.updatedAt > (m.last[doc] ?? 0)) applyLocal(doc, mergeDoc(doc, local, remote.data));
      m.dirty[doc] = true;
      schedule(doc, 0);
    }
    writeMeta(m);
  })().finally(() => {
    pulling = null;
  });
  return pulling;
}

/** Arranca (o corta, con null) la sincronización para la sesión actual. Lo llama AuthProvider. */
export function setSyncAccount(next: string | null): void {
  if (typeof window === "undefined") return;
  if (!installed) {
    installed = true;
    window.addEventListener(STORAGE_EVENT, onLocalChange);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
  }
  if (next === email) return;
  email = next;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  if (email) void pull();
}
