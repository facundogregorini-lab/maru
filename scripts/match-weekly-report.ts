/**
 * Resumen de la actualización semanal (workflow match-weekly).
 *
 *   npx --yes tsx@4 scripts/match-weekly-report.ts --snapshot=/tmp/antes.json
 *   npx --yes tsx@4 scripts/match-weekly-report.ts --compare=/tmp/antes.json --out=resumen.md --max-drop=0.15
 *
 * Cuenta avisos abiertos y elegibles por fuente antes y después. Con --compare escribe el resumen en Markdown
 * y sale con código 2 si los elegibles cayeron más que --max-drop (el workflow abre una issue).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyInventory } from "../src/lib/match/inventory";
import { readInventoryFile } from "../src/lib/match/inventory-file";
import { summarizeWeek, type WeekCounts } from "../src/lib/match/weekly";

const INV = path.join(process.cwd(), "data", "match", "inventory.json");
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function counts(): Promise<WeekCounts> {
  const inv = (await readInventoryFile(INV)) ?? emptyInventory("real");
  const out: WeekCounts = { at: new Date().toISOString(), bySource: {} };
  for (const p of inv.postings) {
    if (p.status !== "abierta") continue;
    const s = (out.bySource[p.sourceId] ??= { open: 0, eligible: 0 });
    s.open++;
    if (p.eligibility.status === "elegible") s.eligible++;
  }
  return out;
}

async function main() {
  const snapshot = arg("snapshot");
  if (snapshot) {
    await writeFile(snapshot, JSON.stringify(await counts()));
    return;
  }
  const compare = arg("compare");
  if (!compare) throw new Error("Usá --snapshot=<archivo> o --compare=<archivo>.");
  const before = JSON.parse(await readFile(compare, "utf8")) as WeekCounts;
  const maxDrop = Number(arg("max-drop") ?? "0.15");
  const { markdown, drop } = summarizeWeek(before, await counts(), maxDrop);
  const out = arg("out");
  if (out) await writeFile(out, markdown);
  console.log(markdown);
  if (drop > maxDrop) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
