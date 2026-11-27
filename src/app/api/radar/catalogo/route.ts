import { json, radarRoute } from "@/lib/radar/http";
import { searchCatalog } from "@/lib/radar/service";

/** Búsqueda en el catálogo global: GET ?q=nombre o dominio. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ req, uid }) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  return json({ results: await searchCatalog(uid, q) });
});
