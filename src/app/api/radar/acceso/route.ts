import { radarAllowedFor } from "@/lib/radar/access";

export const runtime = "nodejs";

/** Si esta persona ve el Radar laboral (feature flag). Lo consulta la navegación. */
export async function GET(req: Request) {
  return Response.json({ enabled: radarAllowedFor(req) }, { headers: { "Cache-Control": "private, no-store" } });
}
