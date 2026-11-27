import { json, radarRoute } from "@/lib/radar/http";
import { monitoringStatus } from "@/lib/radar/monitoring";

/** Estado del monitoreo e historial de corridas de las fuentes de la persona. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => json(await monitoringStatus(uid)));
