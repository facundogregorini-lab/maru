/** localStorage que nunca rompe la app (modo privado, cuota llena, previews). */
export function load<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Avisa qué clave cambió (la sincronización con la cuenta escucha esto). */
export const STORAGE_EVENT = "maru:storage";

function changed(key: string): void {
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }));
  } catch {
    // sin window: nadie escucha
  }
}

export function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin espacio o sin acceso: seguimos sólo con el estado en memoria
  }
  changed(key);
}

export function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // idem
  }
  changed(key);
}
