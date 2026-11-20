import { readFileSync } from "node:fs";
import { readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { sourceById } from "./sources";
import type { Inventory, StoredPosting } from "./types";

/**
 * El inventario se guarda en varios archivos para que ninguno se acerque al límite de GitHub
 * (100 MB; avisa desde 50; el 14/11/2026 `inventory.json` llegó a 105 MB y la sync dejó de guardar):
 * - `inventory.json`: metadatos (corridas, bolsas) y los avisos de los empleadores hasta IMPORTED_CHUNK_BYTES;
 * - `inventory-boards.json`, `inventory-boards-2.json`, …: el resto de los avisos de los empleadores, si no entran;
 * - `inventory-imported.json`, `inventory-imported-2.json`, …: los importados de proveedores con cuota, de hasta
 *   IMPORTED_CHUNK_BYTES cada uno (en el orden en que entraron, así una compra nueva sólo toca las últimas partes).
 * Al leer se juntan; si no hay partes (inventarios viejos o fixtures), se lee el principal solo.
 */
export const IMPORTED_CHUNK_BYTES = 40_000_000;
/** Parte n (1 = la primera) de los importados. */
export const importedFileOf = (file: string, n = 1) => file.replace(/\.json$/, n === 1 ? "-imported.json" : `-imported-${n}.json`);
/** Parte n (1 = la primera) de los avisos de empleadores que no entran en el archivo principal. */
export const boardsFileOf = (file: string, n = 1) => file.replace(/\.json$/, n === 1 ? "-boards.json" : `-boards-${n}.json`);
const POSTINGS_SLOT = "\u0000postings\u0000";
const isImported = (p: StoredPosting) => !!sourceById(p.sourceId)?.imported;

function merge(main: Inventory, boards: { postings?: StoredPosting[] }[], parts: { postings?: StoredPosting[] }[]): Inventory {
  const own = [...main.postings, ...boards.flatMap((p) => p.postings ?? [])];
  const imported = parts.flatMap((p) => p.postings ?? []);
  if (!imported.length) return own.length === main.postings.length ? main : { ...main, postings: own };
  const keys = new Set(own.map((p) => p.key));
  return { ...main, postings: [...own, ...imported.filter((p) => !keys.has(p.key))] };
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
  const boards = [];
  for (let n = 1, raw; (raw = await readOptional(boardsFileOf(file, n))) !== null; n++) boards.push(JSON.parse(raw));
  const parts = [];
  for (let n = 1, raw; (raw = await readOptional(importedFileOf(file, n))) !== null; n++) parts.push(JSON.parse(raw));
  return merge(JSON.parse(main) as Inventory, boards, parts);
}

export function readInventoryFileSync(file: string): Inventory {
  const main = JSON.parse(readFileSync(file, "utf8")) as Inventory;
  const boards = [];
  for (let n = 1, raw; (raw = readOptionalSync(boardsFileOf(file, n))) !== null; n++) boards.push(JSON.parse(raw));
  const parts = [];
  for (let n = 1, raw; (raw = readOptionalSync(importedFileOf(file, n))) !== null; n++) parts.push(JSON.parse(raw));
  return merge(main, boards, parts);
}

const mtime = (file: string) => stat(file).then((s) => s.mtimeMs, () => 0);

/** El más nuevo de los archivos (para la caché del servidor); 0 si no existe el principal. */
export async function inventoryMtime(file: string): Promise<number> {
  const main = await mtime(file);
  if (!main) return 0;
  let newest = main;
  for (let n = 1, t; (t = await mtime(importedFileOf(file, n))); n++) newest = Math.max(newest, t);
  for (let n = 1, t; (t = await mtime(boardsFileOf(file, n))); n++) newest = Math.max(newest, t);
  return newest;
}

/** Reparte los importados en partes de hasta `maxBytes` (siempre al menos una, aunque esté vacía). */
export function chunkImported(postings: StoredPosting[], maxBytes = IMPORTED_CHUNK_BYTES): string[] {
  return chunkJson(postings, maxBytes).map((jsons) => `{"postings":[${jsons.join(",")}]}\n`);
}

/** Avisos serializados, repartidos en grupos de hasta `maxBytes` (siempre al menos uno, aunque esté vacío). */
function chunkJson(postings: StoredPosting[], maxBytes: number): string[][] {
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
  return parts;
}

/**
 * Escribe el principal, las partes de empleadores que no entran en él y las de importados (cada uno con .tmp + rename),
 * y borra las partes que sobran. `inv` ya viene preparado con forStorage.
 */
export async function writeInventoryFile(file: string, inv: Inventory, maxBytes = IMPORTED_CHUNK_BYTES): Promise<void> {
  const parts = chunkImported(inv.postings.filter(isImported), maxBytes);
  const [first, ...rest] = chunkJson(inv.postings.filter((p) => !isImported(p)), maxBytes);
  // Los metadatos van en el principal, con la primera tanda de avisos de empleadores (función de reemplazo:
  // un "$&" dentro de una descripción no se interpreta).
  const head = JSON.stringify({ ...inv, postings: POSTINGS_SLOT });
  const main = `${head.replace(JSON.stringify(POSTINGS_SLOT), () => `[${first.join(",")}]`)}\n`;
  const boards = rest.map((jsons) => `{"postings":[${jsons.join(",")}]}\n`);
  const files: [string, string][] = [
    ...parts.map((body, i): [string, string] => [importedFileOf(file, i + 1), body]),
    ...boards.map((body, i): [string, string] => [boardsFileOf(file, i + 1), body]),
    [file, main],
  ];
  await Promise.all(files.map(([f, body]) => writeFile(`${f}.tmp`, body)));
  // El principal va último: si el proceso muere antes, sigue valiendo el inventario anterior.
  for (const [f] of files) await rename(`${f}.tmp`, f);
  for (let n = parts.length + 1; await mtime(importedFileOf(file, n)); n++) await unlink(importedFileOf(file, n));
  for (let n = boards.length + 1; await mtime(boardsFileOf(file, n)); n++) await unlink(boardsFileOf(file, n));
}
