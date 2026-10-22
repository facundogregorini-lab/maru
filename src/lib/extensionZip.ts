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

/** Lo que vive en extension/ pero no viaja en la extensión: material para la ficha de la Chrome Web Store. */
const NOT_SHIPPED = /^(store\/|STORE_LISTING\.md$)/;

/**
 * La extensión en un .zip con una sola carpeta adentro: se descomprime y esa carpeta
 * es la que se elige en "Cargar descomprimida". Se arma desde extension/, así nunca queda vieja.
 * `store`: el paquete para subir a la Chrome Web Store, con el manifest en la raíz y sin los sitios de desarrollo.
 */
export async function buildExtensionZip(dir = EXTENSION_DIR, { store = false }: { store?: boolean } = {}): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const file of await files(dir)) {
    const name = path.relative(dir, file).split(path.sep).join("/");
    if (name.startsWith(".") || NOT_SHIPPED.test(name)) continue;
    let data: Buffer | string = await readFile(file);
    if (store && name === "manifest.json") data = storeManifest(data.toString("utf8"));
    // Fecha fija: el mismo código da el mismo .zip.
    zip.file(store ? name : `${EXTENSION_FOLDER}/${name}`, data, { date: new Date("2026-01-01T00:00:00Z") });
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Manifest de la Store: sin localhost (sólo sirve para desarrollar) en permisos ni en el puente con el sitio de Maru. */
export function storeManifest(raw: string): string {
  const manifest = JSON.parse(raw) as { host_permissions?: string[]; content_scripts?: { matches: string[] }[] };
  const dev = (m: string) => m.startsWith("http://localhost");
  if (manifest.host_permissions) manifest.host_permissions = manifest.host_permissions.filter((m) => !dev(m));
  for (const cs of manifest.content_scripts ?? []) cs.matches = cs.matches.filter((m) => !dev(m));
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
