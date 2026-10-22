/**
 * Arma el .zip para subir a la Chrome Web Store: `npm run ext:pack`.
 * Controla íconos (16/48/128) y capturas de 1280×800 en extension/store/ y deja el paquete en dist/.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildExtensionZip, EXTENSION_DIR } from "../src/lib/extensionZip";

/** Ancho y alto de un PNG, leídos de su cabecera. */
function pngSize(buf: Buffer): [number, number] | null {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

async function main() {
  const problems: string[] = [];
  const manifest = JSON.parse(await readFile(path.join(EXTENSION_DIR, "manifest.json"), "utf8")) as { version: string; icons: Record<string, string> };
  for (const size of ["16", "48", "128"]) {
    const icon = manifest.icons[size];
    const dims = icon ? pngSize(await readFile(path.join(EXTENSION_DIR, icon))) : null;
    if (!dims || dims[0] !== Number(size) || dims[1] !== Number(size)) problems.push(`Falta el ícono de ${size}×${size} (o no mide eso).`);
  }
  const storeDir = path.join(EXTENSION_DIR, "store");
  const shots = (await readdir(storeDir).catch(() => [])).filter((f) => f.endsWith(".png"));
  if (!shots.length) problems.push("No hay capturas en extension/store/.");
  for (const shot of shots) {
    const dims = pngSize(await readFile(path.join(storeDir, shot)));
    if (!dims || dims[0] !== 1280 || dims[1] !== 800) problems.push(`${shot} no mide 1280×800.`);
  }
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join("\n"));
    process.exit(1);
  }
  await mkdir("dist", { recursive: true });
  const out = path.join("dist", `maru-extension-${manifest.version}-store.zip`);
  await writeFile(out, await buildExtensionZip(EXTENSION_DIR, { store: true }));
  console.log(`✓ ${out} (versión ${manifest.version}, ${shots.length} capturas en extension/store/)`);
}

main();
