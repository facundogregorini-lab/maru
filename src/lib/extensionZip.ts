import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

/** Carpeta de la extensión en el repo y nombre de la carpeta que ve la persona al descomprimir. */
export const EXTENSION_DIR = path.join(process.cwd(), "extension");
export const EXTENSION_FOLDER = "maru-extension";

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : Promise.resolve([path.join(dir, e.name)]))),
  );
  return nested.flat().sort();
}

/**
 * La extensión en un .zip con una sola carpeta adentro: se descomprime y esa carpeta
 * es la que se elige en "Cargar descomprimida". Se arma desde extension/, así nunca queda vieja.
 */
export async function buildExtensionZip(dir = EXTENSION_DIR): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of await files(dir)) {
    const name = path.relative(dir, file).split(path.sep).join("/");
    if (name.startsWith(".")) continue;
    // Fecha fija: el mismo código da el mismo .zip.
    zip.file(`${EXTENSION_FOLDER}/${name}`, await readFile(file), { date: new Date("2026-01-01T00:00:00Z") });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
