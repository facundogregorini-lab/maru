/**
 * Resumen de la actualización semanal (scripts/match-weekly-report.ts, workflow match-weekly). Puro: recibe los
 * conteos de antes y después y devuelve el Markdown y la caída de elegibles (0,2 = 20% menos).
 */

export type WeekCounts = { at: string; bySource: Record<string, { open: number; eligible: number }> };

const total = (c: WeekCounts, k: "open" | "eligible") => Object.values(c.bySource).reduce((a, s) => a + s[k], 0);
const fmt = (n: number) => n.toLocaleString("es-AR");
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");

export function summarizeWeek(before: WeekCounts, after: WeekCounts, maxDrop = 0.15): { markdown: string; drop: number } {
  const eb = total(before, "eligible");
  const ea = total(after, "eligible");
  const drop = eb > 0 ? Math.max(0, (eb - ea) / eb) : 0;
  const sources = [...new Set([...Object.keys(before.bySource), ...Object.keys(after.bySource)])].sort(
    (a, b) => (after.bySource[b]?.eligible ?? 0) - (after.bySource[a]?.eligible ?? 0) || a.localeCompare(b),
  );
  const rows = sources.map((s) => {
    const b = before.bySource[s] ?? { open: 0, eligible: 0 };
    const a = after.bySource[s] ?? { open: 0, eligible: 0 };
    return `| ${s} | ${fmt(a.open)} | ${fmt(a.eligible)} | ${signed(a.eligible - b.eligible)} |`;
  });
  const lines = [
    "## Actualización semanal de avisos",
    "",
    `Elegibles desde la Argentina: **${fmt(ea)}** (antes ${fmt(eb)}, ${signed(ea - eb)}). Abiertos: ${fmt(total(after, "open"))} (antes ${fmt(total(before, "open"))}).`,
    "",
    drop > maxDrop ? `⚠️ Los elegibles cayeron ${Math.round(drop * 100)}%, más que el ${Math.round(maxDrop * 100)}% tolerado.` : "",
    "",
    "| Fuente | Abiertos | Elegibles | Cambio en elegibles |",
    "| --- | ---: | ---: | ---: |",
    ...rows,
    "",
  ];
  return { markdown: lines.filter((l, i, all) => !(l === "" && all[i - 1] === "")).join("\n"), drop };
}
