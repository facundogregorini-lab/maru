import { z } from "zod";
import { loadDirectory, loadInventory } from "@/lib/match/load";
import { radarAllowedFor, radarNotFound } from "@/lib/radar/access";
import { buildIndex, statusFor, type CompanyStatus, type StatusIndex } from "@/lib/radar/status";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  companies: z
    .array(z.object({ id: z.string().min(1).max(200), name: z.string().min(1).max(120), board: z.string().max(200).optional(), careersUrl: z.string().max(600).optional() }))
    .max(1500),
});

let cached: { mtime: number; idx: StatusIndex } | null = null;

/**
 * Estado de monitoreo de las empresas del Radar contra el inventario compartido.
 * Sólo recibe nombres y links públicos de empresas; no guarda ni registra nada.
 */
export async function POST(req: Request) {
  if (!radarAllowedFor(req)) return radarNotFound();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pedido inválido.", code: "BAD_REQUEST" }, { status: 400 });
  try {
    const { inv, postings, mtime } = await loadInventory();
    if (!cached || cached.mtime !== mtime) cached = { mtime, idx: buildIndex(inv, postings, await loadDirectory()) };
    const statuses: Record<string, CompanyStatus> = {};
    for (const c of parsed.data.companies) statuses[c.id] = statusFor(c, cached.idx);
    return Response.json({ generatedAt: cached.idx.generatedAt, statuses }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[radar/estado]", err instanceof Error ? err.message : err);
    return Response.json({ error: "No pudimos leer el inventario de avisos. Probá de nuevo en unos minutos.", code: "INVENTORY_UNAVAILABLE" }, { status: 503 });
  }
}
