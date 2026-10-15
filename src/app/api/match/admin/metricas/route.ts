import { adminDenied } from "@/lib/match/admin";
import { loadDirectory, loadInventory } from "@/lib/match/load";
import { coverageMetrics } from "@/lib/match/metrics";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = adminDenied(req);
  if (denied) return denied;
  const [{ inv }, dir] = await Promise.all([loadInventory(), loadDirectory()]);
  return Response.json(coverageMetrics(inv, dir), { headers: { "Cache-Control": "no-store" } });
}
