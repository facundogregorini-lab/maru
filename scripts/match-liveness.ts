/**
 * Mira la página original de los avisos importados y cierra los que ya no existen (src/lib/match/liveness.ts).
 *
 *   npx --yes tsx@4 scripts/match-liveness.ts --max=1500 --budget-min=15
 *
 * Lo corre el workflow match-sync después de la sincronización. Sólo GET públicos, sin claves.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { emptyInventory, forStorage } from "../src/lib/match/inventory";
import { readInventoryFile, writeInventoryFile } from "../src/lib/match/inventory-file";
import { checkImportedLiveness } from "../src/lib/match/liveness";
import type { Inventory } from "../src/lib/match/types";

const INV = path.join(process.cwd(), "data", "match", "inventory.json");
const STATE = path.join(process.cwd(), "data", "match", "sync-state.json");

async function main() {
  const max = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 150);
  const budgetMin = Number(process.argv.find((a) => a.startsWith("--budget-min="))?.slice(13) ?? 8);
  const state = JSON.parse(await readFile(STATE, "utf8").catch(() => "{}")) as { lock?: unknown };
  if (state.lock) throw new Error("Hay una sincronización en curso: no se toca el inventario.");
  const inv = { ...emptyInventory("real"), ...((await readInventoryFile(INV)) as Inventory) };
  if (inv.kind !== "real") throw new Error("inventory.json no es un inventario real.");
  const stats = await checkImportedLiveness(inv, new Date().toISOString(), {
    max: Number.isFinite(max) ? Math.min(max, 2000) : 150,
    budgetMs: (Number.isFinite(budgetMin) && budgetMin > 0 ? budgetMin : 8) * 60_000,
    log: (m) => console.log(m),
  });
  await writeInventoryFile(INV, forStorage(inv));
  console.log(`Vigencia de importados: ${stats.checked} revisados, ${stats.closed} cerrados, ${stats.open} siguen publicados, ${stats.unknown} sin dato.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
