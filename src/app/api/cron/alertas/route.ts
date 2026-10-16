import { alertEmails, describeQuery, listAlerts, markSent, queryToSearch } from "@/lib/alerts";
import { createUnsubToken } from "@/lib/auth";
import { searchJobs } from "@/lib/busquedas";
import { dbEnabled } from "@/lib/db";
import { sendAlertDigest, type AlertBlock } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 300;

const PER_ALERT = 8;

/**
 * Cron diario (vercel.json): manda a cada persona las búsquedas publicadas desde su último aviso.
 * Vercel lo llama con "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("no autorizado", { status: 401 });
  if (!dbEnabled()) return Response.json({ sent: 0, reason: "sin base de datos" });

  let sent = 0;
  let failed = 0;
  for (const email of await alertEmails()) {
    try {
      const alerts = await listAlerts(email);
      const blocks: AlertBlock[] = [];
      for (const a of alerts) {
        const { results } = await searchJobs({ ...a.query, pagina: 1 });
        const fresh = results.filter((j) => j.postedAt > a.lastSentAt).slice(0, PER_ALERT);
        if (fresh.length)
          blocks.push({
            title: describeQuery(a.query),
            url: `${SITE_URL}${queryToSearch(a.query)}`,
            jobs: fresh.map((j) => ({ title: j.title, company: j.company, where: j.where, url: `${SITE_URL}/busquedas/${j.id}` })),
          });
      }
      if (!blocks.length) continue;
      await sendAlertDigest(email, blocks, `${SITE_URL}/api/alertas/baja?token=${encodeURIComponent(createUnsubToken(email))}`);
      await markSent(
        email,
        alerts.map((a) => a.id),
      );
      sent++;
    } catch (err) {
      failed++;
      console.error("[cron/alertas]", err instanceof Error ? err.message : err);
    }
  }
  return Response.json({ sent, failed });
}
