import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Directory } from "./directory";
import { groupOpportunities } from "./group";
import { emptyInventory } from "./inventory";
import type { Inventory, StoredPosting } from "./types";

/**
 * Lee el inventario compartido (data/match/inventory.json) del servidor.
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

export async function loadInventory(file = process.env.MATCH_INVENTORY_PATH ?? path.join(DATA_DIR, "inventory.json")): Promise<Loaded> {
  let mtime = 0;
  try {
    mtime = (await stat(file)).mtimeMs;
  } catch {
    return { inv: emptyInventory("real"), postings: new Map(), alias: new Map(), mtime: 0 };
  }
  if (cache && cache.mtime === mtime) return cache;
  const raw = { ...emptyInventory("real"), ...(JSON.parse(await readFile(file, "utf8")) as Inventory) };
  const { opportunities, alias } = groupOpportunities(raw.opportunities);
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
}
