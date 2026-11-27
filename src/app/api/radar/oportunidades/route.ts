import { json, radarRoute } from "@/lib/radar/http";
import { detectedOpportunities } from "@/lib/radar/service";

/** Vacantes detectadas en las empresas que sigue la persona (sin evaluar) y, aparte, las del piloto. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => json(await detectedOpportunities(uid)));
