import { loadInventory } from "@/lib/match/load";

export const runtime = "nodejs";

/** Texto completo de una oportunidad del inventario, para preparar la postulación con el coach. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{6,40}$/.test(id)) return Response.json({ error: "Oportunidad inválida.", code: "BAD_REQUEST" }, { status: 400 });
  const { inv, postings } = await loadInventory();
  const opp = inv.opportunities.find((o) => o.id === id);
  if (!opp) return Response.json({ error: "Esta búsqueda ya no está en el inventario.", code: "NOT_FOUND" }, { status: 404 });
  const primary = postings.get(opp.primaryKey);
  return Response.json({
    id: opp.id,
    title: opp.title,
    company: opp.company,
    url: primary?.applyUrl || primary?.sourceUrl || "",
    text: primary?.descriptionText ?? "",
    complete: opp.descriptionComplete,
  });
}
