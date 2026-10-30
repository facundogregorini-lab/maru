import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Directory } from "./directory";
import { groupOpportunities } from "./group";
import { emptyInventory, opportunitiesOf } from "./inventory";
import { inventoryMtime, readInventoryFile } from "./inventory-file";
import { withCompanyLogos } from "./logos";
import type { Inventory, StoredPosting } from "./types";

/**
 * Lee el inventario compartido (data/match/inventory.json + inventory-imported.json, ver inventory-file.ts) del servidor.
 * Se cachea en memoria y se recarga si cambió el archivo. Nunca contiene datos de usuarios.
 *
 * Almacenamiento: hoy Maru no tiene base de datos, así que el inventario es un archivo versionado
 * que genera la sincronización programada. Para pasar a una base de datos alcanza con reemplazar
 * esta función y saveInventory del script por un adaptador que implemente la misma interfaz.
 */

const DATA_DIR = path.join(process.cwd(), "data", "match");

/** `inv.opportunities` llega agrupado (un puesto por empresa); `alias` lleva los ids de las copias al representante. */
type Loaded = { inv: Inventory; postings: Map<string, StoredPosting>; alias: Map<string, string>; mtime: number };
let cache: Loaded | null = null;
/**
 * La carga en curso, compartida: en una instancia nueva, la página de una búsqueda pide el inventario dos veces
 * a la vez (metadatos y contenido) y cada lectura arma ~137 MB de JSON. Leerlo en paralelo agotaba la memoria.
 */
let pending: { key: string; promise: Promise<Loaded> } | null = null;

export async function loadInventory(file = process.env.MATCH_INVENTORY_PATH ?? path.join(DATA_DIR, "inventory.json")): Promise<Loaded> {
  const mtime = await inventoryMtime(file);
  if (!mtime) return { inv: emptyInventory("real"), postings: new Map(), alias: new Map(), mtime: 0 };
  if (cache && cache.mtime === mtime) return cache;
  const key = `${file}:${mtime}`;
  if (pending?.key === key) return pending.promise;
  const promise = readAndGroup(file, mtime).finally(() => {
    if (pending?.promise === promise) pending = null;
  });
  pending = { key, promise };
  return promise;
}

async function readAndGroup(file: string, mtime: number): Promise<Loaded> {
  const stored = await readInventoryFile(file);
  if (!stored) return { inv: emptyInventory("real"), postings: new Map(), alias: new Map(), mtime: 0 };
  const read = { ...emptyInventory("real"), ...stored };
  const raw = { ...read, postings: withCompanyLogos(read.postings) };
  const { opportunities, alias } = groupOpportunities(opportunitiesOf(raw));
  const inv = { ...raw, opportunities };
  cache = { inv, postings: new Map(inv.postings.map((p) => [p.key, p])), alias, mtime };
  return cache;
}

/** El id de una búsqueda agrupada: si era una copia, el del representante. */
export function resolveId(alias: Map<string, string>, id: string): string {
  return alias.get(id) ?? id;
}

export async function loadDirectory(): Promise<Directory> {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "companies.json"), "utf8")) as Directory;
  } catch {
    return { reviewedAt: "", companies: [] };
  }
}

/** Para tests: olvidar la caché. */
export function resetInventoryCache() {
  cache = null;
  pending = null;
}
