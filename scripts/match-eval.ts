/**
 * Top 20 de /match para los perfiles de evaluación, contra el inventario local.
 * Uso: npx tsx scripts/match-eval.ts [salida.md] [--ia]
 * Sin --ia: sólo la etapa por reglas, sin red. Con --ia: también la re-evaluación con IA
 * (necesita ANTHROPIC_API_KEY; cuesta centavos con Haiku).
 */
import { writeFile } from "node:fs/promises";
import { loadInventory } from "../src/lib/match/load";
import { rankOpportunities, type RankedItem } from "../src/lib/match/ranking";
import { rerank, rerankModel } from "../src/lib/match/rerank";
import { EVAL_CASES } from "../tests/match-eval-cases";

const cell = (s: string | null | undefined) => (s ?? "—").replace(/\|/g, "/").replace(/\s+/g, " ").slice(0, 110);

function table(items: RankedItem[]): string {
  const rows = items.map((x, i) => `| ${i + 1} | ${x.score} | ${cell(x.title)} | ${cell(x.company)} | ${x.seniority ?? "—"} | ${cell(x.salary)} | ${cell(x.reasons[0])} |`);
  return ["| # | % | Aviso | Empresa | Nivel | Salario | Primera razón |", "| --- | ---: | --- | --- | --- | --- | --- |", ...rows].join("\n");
}

async function main() {
  const { inv, postings } = await loadInventory();
  const now = new Date(inv.generatedAt ?? Date.now());
  const ia = process.argv.includes("--ia");
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const opportunities = new Map(inv.opportunities.map((o) => [o.id, o]));
  const out = [`# Evaluación de /match\n\nInventario del ${inv.generatedAt}. Perfiles ficticios de \`tests/match-eval-cases.ts\`. ${ia ? `Con re-evaluación por IA (${rerankModel()}).` : "Sólo la etapa por reglas."}`];
  for (const c of EVAL_CASES) {
    const ranked = rankOpportunities({ opportunities: inv.opportunities, postings, profile: c.profile, prefs: c.prefs, interactions: { saved: [], discarded: [] }, limit: 40, now });
    const r = ia ? await rerank({ result: ranked, profile: c.profile, prefs: c.prefs, opportunities, postings }) : ranked;
    r.eligible = r.eligible.slice(0, 20);
    out.push(`## ${c.name}\n\nPara vos: ${r.counts.eligible} · Por confirmar: ${r.counts.pending}\n\n### Para vos (top 20)\n\n${table(r.eligible)}\n\n### Por confirmar (top 10)\n\n${table(r.pending.slice(0, 10))}`);
  }
  const text = out.join("\n\n") + "\n";
  if (file) await writeFile(file, text);
  else process.stdout.write(text);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
