import { dbConfigured } from "@/lib/db";
import { runRadarCron, type CronPhase } from "@/lib/radar/cron";
import { radarFlagOn } from "@/lib/radar/flag";
import { resendRadarSender } from "@/lib/radar/notify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron de Radar laboral (vercel.json), con `Authorization: Bearer CRON_SECRET`.
 * Con RADAR_ENABLED apagado responde sin hacer nada. ?phase=crawl|match|deliver corre una sola fase.
 * Sin RESEND_API_KEY entrega sólo in-app.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Falta CRON_SECRET.", code: "NOT_CONFIGURED" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  if (!radarFlagOn()) return Response.json({ skipped: "flag" }, { headers: { "Cache-Control": "no-store" } });
  if (!dbConfigured()) return Response.json({ error: "La base de datos no está configurada.", code: "DB_NOT_CONFIGURED" }, { status: 503 });
  const phase = new URL(req.url).searchParams.get("phase");
  const phases = phase && ["crawl", "match", "deliver"].includes(phase) ? [phase as CronPhase] : undefined;
  try {
    const summary = await runRadarCron({ phases, send: process.env.RESEND_API_KEY ? resendRadarSender : null });
    console.log("[cron/radar]", JSON.stringify(summary));
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cron/radar]", err instanceof Error ? err.message.slice(0, 120) : "error");
    return Response.json({ error: "No se pudo completar la corrida.", code: "UNKNOWN" }, { status: 500 });
  }
}
