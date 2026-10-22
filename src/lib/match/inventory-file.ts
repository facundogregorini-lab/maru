import { readFileSync } from "node:fs";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { sourceById } from "./sources";
import type { Inventory, StoredPosting } from "./types";

/**
 * El inventario se guarda en varios archivos para que ninguno se acerque al límite de GitHub
 * (100 MB; avisa desde 50): `inventory.json` con todo menos los avisos importados de proveedores
 * con cuota, y esos avisos en `inventory-imported.json`, `inventory-imported-2.json`, … de hasta
 * IMPORTED_CHUNK_BYTES cada uno (en el orden en que entraron, así una compra nueva sólo toca las últimas partes).
 * Al leer se juntan; si no hay partes (inventarios viejos o fixtures), se lee el principal solo.
 */
export const IMPORTED_CHUNK_BYTES = 40_000_000;
/** Parte n (1 = la primera) de los importados. */
export const importedFileOf = (file: string, n = 1) => file.replace(/\.json$/, n === 1 ? "-imported.json" : `-imported-${n}.json`);
const isImported = (p: StoredPosting) => !!sourceById(p.sourceId)?.imported;

function merge(main: Inventory, parts: { postings?: StoredPosting[] }[]): Inventory {
  const imported = parts.flatMap((p) => p.postings ?? []);
  if (!imported.length) return main;
  const keys = new Set(main.postings.map((p) => p.key));
  return { ...main, postings: [...main.postings, ...imported.filter((p) => !keys.has(p.key))] };
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function readOptionalSync(file: string): string | null {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** null si no existe el archivo principal. */
export async function readInventoryFile(file: string): Promise<Inventory | null> {
  const main = await readOptional(file);
  if (main === null) return null;
  const parts = [];
  for (let n = 1, raw; (raw = await readOptional(importedFileOf(file, n))) !== null; n++) parts.push(JSON.parse(raw));
  return merge(JSON.parse(main) as Inventory, parts);
}

export function readInventoryFileSync(file: string): Inventory {
  const main = JSON.parse(readFileSync(file, "utf8")) as Inventory;
  const parts = [];
  for (let n = 1, raw; (raw = readOptionalSync(importedFileOf(file, n))) !== null; n++) parts.push(JSON.parse(raw));
  return merge(main, parts);
}

const mtime = (file: string) => stat(file).then((s) => s.mtimeMs, () => 0);

/** El más nuevo de los archivos (para la caché del servidor); 0 si no existe el principal. */
export async function inventoryMtime(file: string): Promise<number> {
  const main = await mtime(file);
  if (!main) return 0;
  let newest = main;
  for (let n = 1, t; (t = await mtime(importedFileOf(file, n))); n++) newest = Math.max(newest, t);
  return newest;
}

/** Reparte los importados en partes de hasta `maxBytes` (siempre al menos una, aunque esté vacía). */
export function chunkImported(postings: StoredPosting[], maxBytes = IMPORTED_CHUNK_BYTES): string[] {
  const parts: string[][] = [[]];
  let size = 0;
  for (const p of postings) {
    const json = JSON.stringify(p);
    const bytes = Buffer.byteLength(json) + 1;
    if (size + bytes > maxBytes && parts[parts.length - 1].length) {
      parts.push([]);
      size = 0;
    }
    parts[parts.length - 1].push(json);
    size += bytes;
  }
  return parts.map((jsons) => `{"postings":[${jsons.join(",")}]}\n`);
}

/** Escribe el principal y las partes de importados (cada uno con .tmp + rename) y borra las partes que sobran. `inv` ya viene preparado con forStorage. */
export async function writeInventoryFile(file: string, inv: Inventory, maxBytes = IMPORTED_CHUNK_BYTES): Promise<void> {
  const parts = chunkImported(inv.postings.filter(isImported), maxBytes);
  const main = { ...inv, postings: inv.postings.filter((p) => !isImported(p)) };
  await Promise.all(parts.map((body, i) => writeFile(`${importedFileOf(file, i + 1)}.tmp`, body)));
  await writeFile(`${file}.tmp`, JSON.stringify(main) + "\n");
  for (let i = 0; i < parts.length; i++) await rename(`${importedFileOf(file, i + 1)}.tmp`, importedFileOf(file, i + 1));
  await rename(`${file}.tmp`, file);
  for (let n = parts.length + 1; await mtime(importedFileOf(file, n)); n++) await unlink(importedFileOf(file, n));
}
