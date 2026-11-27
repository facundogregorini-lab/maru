import { boardIdFor } from "@/lib/match/directory";
import { loadDirectory } from "@/lib/match/load";
import { radarAllowedFor, radarNotFound } from "@/lib/radar/access";

export const runtime = "nodejs";

/** Empresas del directorio de Match (las que Maru ya lee todos los días), para buscarlas al agregar una al Radar. */
export async function GET(req: Request) {
  if (!radarAllowedFor(req)) return radarNotFound();
  const dir = await loadDirectory();
  const seen = new Set<string>();
  const companies = [];
  for (const c of dir.companies) {
    if (c.status !== "candidata" || !c.sourceId || !c.slug) continue;
    const board = boardIdFor(c.sourceId, c.slug);
    if (seen.has(board)) continue;
    seen.add(board);
    companies.push({ name: c.name, board, sector: c.sector ?? "", url: c.evidence.split(" ")[0] });
  }
  return Response.json({ companies }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
