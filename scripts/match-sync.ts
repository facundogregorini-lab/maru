/**
 * Sincroniza el inventario compartido de oportunidades.
 *
 *   npm run match:sync                  # todas las bolsas activas
 *   npm run match:sync -- --only=greenhouse:clara,remotive
 *   MATCH_SYNC_BUDGET_MS=600000 npm run match:sync
 *
 * Escribe data/match/inventory.json y data/match/sync-state.json (checkpoint + lock).
 * Lo corre el workflow .github/workflows/match-sync.yml una vez por día.
 * Nunca envía datos de usuarios a las fuentes: sólo hace GET públicos.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { boardsFrom, type Directory } from "../src/lib/match/directory";
import { emptyInventory, forStorage, opportunitiesOf } from "../src/lib/match/inventory";
import { readInventoryFile, writeInventoryFile } from "../src/lib/match/inventory-file";
import { runSync, type SyncState } from "../src/lib/match/sync";

const DATA = path.join(process.cwd(), "data", "match");
const INV = path.join(DATA, "inventory.json");
const STATE = path.join(DATA, "sync-state.json");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Escritura atómica: si el proceso muere a mitad, el archivo anterior queda intacto. */
async function writeJson(file: string, data: unknown, pretty = false) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, pretty ? 2 : undefined) + "\n");
  await rename(tmp, file);
}

async function main() {
  const dir = await readJson<Directory>(path.join(DATA, "companies.json"), { reviewedAt: "", companies: [] });
  const all = boardsFrom(dir);
  let boards = all;
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  if (only) {
    const set = new Set(only.split(","));
    boards = boards.filter((b) => set.has(b.boardId));
  }
  console.log(`Bolsas a sincronizar: ${boards.length}`);

  const outcome = await runSync({
    boards,
    activeBoardIds: all.map((b) => b.boardId),
    loadInventory: async () => {
      const inv = (await readInventoryFile(INV)) ?? emptyInventory("real");
      if (inv.kind !== "real") throw new Error("inventory.json no es un inventario real: no se mezcla con fixtures.");
      return { ...emptyInventory("real"), ...inv };
    },
    saveInventory: (inv) => writeInventoryFile(INV, forStorage(inv)),
    loadState: () => readJson<SyncState>(STATE, { lock: null, checkpoint: null }),
    saveState: (s) => writeJson(STATE, s, true),
    budgetMs: Number(process.env.MATCH_SYNC_BUDGET_MS) || 20 * 60_000,
    log: (m) => console.log(m),
  });

  const inv = (await readInventoryFile(INV)) ?? emptyInventory("real");
  const open = opportunitiesOf(inv).filter((o) => o.status === "abierta");
  const by = (s: string) => open.filter((o) => o.eligibility.status === s).length;
  console.log(
    `\nResultado: ${outcome.status}. Bolsas procesadas: ${outcome.processed}, pendientes: ${outcome.pending}, con error: ${outcome.results.filter((r) => !r.ok).length}.`,
  );
  console.log(`Oportunidades abiertas: ${open.length} (elegibles ${by("elegible")}, por confirmar ${by("por_confirmar")}, no elegibles ${by("no_elegible")}).`);
  if (outcome.status === "bloqueada") process.exitCode = 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
