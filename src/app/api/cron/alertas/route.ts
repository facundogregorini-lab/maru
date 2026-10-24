import { resendConfigured, resendSender, runAlerts } from "@/lib/alerts";
import { hasPaidPlan } from "@/lib/billing/server";
import { dbConfigured } from "@/lib/db";
import { loadInventory } from "@/lib/match/load";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Alertas semanales: la corre el cron de Vercel (vercel.json) con `Authorization: Bearer CRON_SECRET`.
 * Sin CRON_SECRET no corre. Sin RESEND_API_KEY rankea y cuenta, pero no manda.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Falta CRON_SECRET.", code: "NOT_CONFIGURED" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  if (!dbConfigured()) return Response.json({ error: "La base de datos no está configurada.", code: "DB_NOT_CONFIGURED" }, { status: 503 });
  try {
    const { inv, postings } = await loadInventory();
    const summary = await runAlerts({ opportunities: inv.opportunities, postings, isPaid: hasPaidPlan, send: resendConfigured() ? resendSender : null });
    console.log("[cron/alertas]", JSON.stringify(summary));
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cron/alertas]", err instanceof Error ? err.message : "error");
    return Response.json({ error: "No se pudieron procesar las alertas.", code: "UNKNOWN" }, { status: 500 });
  }
}
