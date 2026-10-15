import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Directory } from "./directory";
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

type Loaded = { inv: Inventory; postings: Map<string, StoredPosting>; mtime: number };
let cache: Loaded | null = null;

export async function loadInventory(file = process.env.MATCH_INVENTORY_PATH ?? path.join(DATA_DIR, "inventory.json")): Promise<Loaded> {
  let mtime = 0;
  try {
    mtime = (await stat(file)).mtimeMs;
  } catch {
    return { inv: emptyInventory("real"), postings: new Map(), mtime: 0 };
  }
  if (cache && cache.mtime === mtime) return cache;
  const inv = { ...emptyInventory("real"), ...(JSON.parse(await readFile(file, "utf8")) as Inventory) };
  cache = { inv, postings: new Map(inv.postings.map((p) => [p.key, p])), mtime };
  return cache;
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
