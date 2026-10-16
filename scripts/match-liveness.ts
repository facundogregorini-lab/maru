/**
 * Mira la página original de los avisos importados y cierra los que ya no existen (src/lib/match/liveness.ts).
 *
 *   npx --yes tsx@4 scripts/match-liveness.ts --max=150
 *
 * Lo corre el workflow match-sync después de la sincronización. Sólo GET públicos, sin claves.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyInventory, forStorage } from "../src/lib/match/inventory";
import { checkImportedLiveness } from "../src/lib/match/liveness";
import type { Inventory } from "../src/lib/match/types";

const INV = path.join(process.cwd(), "data", "match", "inventory.json");
const STATE = path.join(process.cwd(), "data", "match", "sync-state.json");

async function main() {
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 150);
  const state = JSON.parse(await readFile(STATE, "utf8").catch(() => "{}")) as { lock?: unknown };
  if (state.lock) throw new Error("Hay una sincronización en curso: no se toca el inventario.");
  const inv = { ...emptyInventory("real"), ...(JSON.parse(await readFile(INV, "utf8")) as Inventory) };
  if (inv.kind !== "real") throw new Error("inventory.json no es un inventario real.");
  const stats = await checkImportedLiveness(inv, new Date().toISOString(), { max: Number.isFinite(max) ? Math.min(max, 500) : 150, log: (m) => console.log(m) });
  await writeFile(`${INV}.tmp`, JSON.stringify(forStorage(inv)) + "\n");
  await rename(`${INV}.tmp`, INV);
  console.log(`Vigencia de importados: ${stats.checked} revisados, ${stats.closed} cerrados, ${stats.open} siguen publicados, ${stats.unknown} sin dato.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
