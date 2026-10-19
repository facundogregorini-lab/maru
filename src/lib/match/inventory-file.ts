import { readFileSync } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { sourceById } from "./sources";
import type { Inventory, StoredPosting } from "./types";

/**
 * El inventario se guarda en dos archivos para que ninguno se acerque al límite de GitHub
 * (100 MB; avisa desde 50): `inventory.json` con todo menos los avisos importados de proveedores
 * con cuota, e `inventory-imported.json` sólo con esos avisos. Al leer se juntan; si el segundo
 * no existe (inventarios viejos o fixtures), se lee el primero solo.
 */
export const importedFileOf = (file: string) => file.replace(/\.json$/, "-imported.json");
const isImported = (p: StoredPosting) => !!sourceById(p.sourceId)?.imported;

function merge(main: Inventory, imported: { postings?: StoredPosting[] } | null): Inventory {
  if (!imported?.postings?.length) return main;
  const keys = new Set(main.postings.map((p) => p.key));
  return { ...main, postings: [...main.postings, ...imported.postings.filter((p) => !keys.has(p.key))] };
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

/** null si no existe el archivo principal. */
export async function readInventoryFile(file: string): Promise<Inventory | null> {
  const main = await readOptional(file);
  if (main === null) return null;
  const imported = await readOptional(importedFileOf(file));
  return merge(JSON.parse(main) as Inventory, imported ? JSON.parse(imported) : null);
}

export function readInventoryFileSync(file: string): Inventory {
  const main = JSON.parse(readFileSync(file, "utf8")) as Inventory;
  let imported: { postings?: StoredPosting[] } | null = null;
  try {
    imported = JSON.parse(readFileSync(importedFileOf(file), "utf8"));
  } catch {
    imported = null;
  }
  return merge(main, imported);
}

/** El más nuevo de los dos archivos (para la caché del servidor); 0 si no existe el principal. */
export async function inventoryMtime(file: string): Promise<number> {
  const [a, b] = await Promise.all([stat(file).then((s) => s.mtimeMs, () => 0), stat(importedFileOf(file)).then((s) => s.mtimeMs, () => 0)]);
  return a ? Math.max(a, b) : 0;
}

/** Escribe los dos archivos (cada uno con .tmp + rename). `inv` ya viene preparado con forStorage. */
export async function writeInventoryFile(file: string, inv: Inventory): Promise<void> {
  const imported = inv.postings.filter(isImported);
  const main = { ...inv, postings: inv.postings.filter((p) => !isImported(p)) };
  const out = importedFileOf(file);
  await writeFile(`${out}.tmp`, JSON.stringify({ postings: imported }) + "\n");
  await writeFile(`${file}.tmp`, JSON.stringify(main) + "\n");
  await rename(`${out}.tmp`, out);
  await rename(`${file}.tmp`, file);
}
