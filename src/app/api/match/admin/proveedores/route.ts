import { z } from "zod";
import { adminDenied } from "@/lib/match/admin";
import { takeCounter } from "@/lib/db";
import { loadInventory } from "@/lib/match/load";
import { ProviderError, runProviderPilot } from "@/lib/match/provider-pilot";
export const runtime = "nodejs";
export const maxDuration = 240;
const Body = z.object({ provider: z.enum(["fantastic", "serp"]), action: z.enum(["status", "sample"]) }).strict();
export async function POST(req: Request) {
  const denied = adminDenied(req); if (denied) return denied;
  if (req.headers.get("origin") !== new URL(req.url).origin) return Response.json({ error: "Abrí la prueba desde el panel de Maru.", code: "BAD_ORIGIN" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Elegí proveedor y acción válidos.", code: "BAD_REQUEST" }, { status: 400 });
  const { provider, action } = parsed.data;
  try {
    // Tope global de todo el panel, no por usuario ni por instancia. Falla cerrado sin Redis.
    const wait = await takeCounter(`maru:provider-pilot:${provider}:${action}`, action === "sample" ? 2 : 3, 86400000);
    if (wait) return Response.json({ error: "Llegamos al tope diario de pruebas para este proveedor.", code: "PILOT_LIMIT" }, { status: 429, headers: { "Retry-After": String(wait) } });
    const { inv } = await loadInventory();
    const urls = inv.postings.flatMap((p) => [p.sourceUrl, p.applyUrl]);
    return Response.json(await runProviderPilot(provider, action, urls), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof ProviderError ? e.message : "No pudimos completar la prueba. No se reintentó ni se publicaron avisos.", code: e instanceof ProviderError ? e.code : "PILOT_UNAVAILABLE" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
