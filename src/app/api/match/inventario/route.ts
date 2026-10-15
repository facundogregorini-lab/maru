import { countBy } from "@/lib/match/inventory";
import { loadInventory } from "@/lib/match/load";
import { enabledSources } from "@/lib/match/sources";

export const runtime = "nodejs";

/** Cifras reales y públicas del inventario (sin datos de usuarios). */
export async function GET() {
  const { inv } = await loadInventory();
  const open = inv.opportunities.filter((o) => o.status === "abierta");
  const active = enabledSources();
  return Response.json(
    {
      generatedAt: inv.generatedAt,
      open: open.length,
      byEligibility: countBy(open, (o) => o.eligibility.status),
      byFamily: countBy(
        open.filter((o) => o.eligibility.status !== "no_elegible"),
        (o) => o.extracted.family.value,
      ),
      sources: active.map((s) => ({ id: s.id, name: s.name, attribution: s.attribution ?? null })),
      companies: Object.values(inv.boards).filter((b) => b.lastOkAt && !["remotive", "jobicy", "getonbrd"].includes(b.sourceId)).length,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
