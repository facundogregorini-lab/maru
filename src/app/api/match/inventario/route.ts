import { countBy } from "@/lib/match/inventory";
import { loadInventory } from "@/lib/match/load";
import { enabledSources, SOURCES } from "@/lib/match/sources";

export const runtime = "nodejs";

/** Cifras reales y públicas del inventario (sin datos de usuarios). */
export async function GET() {
  const { inv, postings } = await loadInventory();
  const open = inv.opportunities.filter((o) => o.status === "abierta");
  // Fuentes diarias + importaciones puntuales que hoy aportan avisos abiertos (nada más).
  const imported = new Set([...postings.values()].filter((p) => p.status === "abierta").map((p) => p.sourceId));
  const active = [...enabledSources(), ...SOURCES.filter((s) => s.imported && imported.has(s.id))];
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
      // Empleadores distintos con búsquedas abiertas (igual que la portada); no bolsas ni feeds importados.
      companies: new Set(open.map((o) => o.company.trim().toLowerCase()).filter(Boolean)).size,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
