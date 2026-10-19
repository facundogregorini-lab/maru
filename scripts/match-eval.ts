/**
 * Top 20 de /match para los perfiles de evaluación, contra el inventario local.
 * Uso: npx tsx scripts/match-eval.ts [salida.md]
 * Sin red ni IA: muestra la etapa determinística (filtros y puntaje por reglas).
 */
import { writeFile } from "node:fs/promises";
import { loadInventory } from "../src/lib/match/load";
import { rankOpportunities, type RankedItem } from "../src/lib/match/ranking";
import { EVAL_CASES } from "../tests/match-eval-cases";

const cell = (s: string | null | undefined) => (s ?? "—").replace(/\|/g, "/").replace(/\s+/g, " ").slice(0, 110);

function table(items: RankedItem[]): string {
  const rows = items.map((x, i) => `| ${i + 1} | ${x.score} | ${cell(x.title)} | ${cell(x.company)} | ${x.seniority ?? "—"} | ${cell(x.salary)} | ${cell(x.reasons[0])} |`);
  return ["| # | % | Aviso | Empresa | Nivel | Salario | Primera razón |", "| --- | ---: | --- | --- | --- | --- | --- |", ...rows].join("\n");
}

async function main() {
  const { inv, postings } = await loadInventory();
  const now = new Date(inv.generatedAt ?? Date.now());
  const out = [`# Evaluación de /match\n\nInventario del ${inv.generatedAt}. Perfiles ficticios de \`tests/match-eval-cases.ts\`.`];
  for (const c of EVAL_CASES) {
    const r = rankOpportunities({ opportunities: inv.opportunities, postings, profile: c.profile, prefs: c.prefs, interactions: { saved: [], discarded: [] }, limit: 20, now });
    out.push(`## ${c.name}\n\nPara vos: ${r.counts.eligible} · Por confirmar: ${r.counts.pending}\n\n### Para vos (top 20)\n\n${table(r.eligible)}\n\n### Por confirmar (top 10)\n\n${table(r.pending.slice(0, 10))}`);
  }
  const text = out.join("\n\n") + "\n";
  if (process.argv[2]) await writeFile(process.argv[2], text);
  else process.stdout.write(text);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
