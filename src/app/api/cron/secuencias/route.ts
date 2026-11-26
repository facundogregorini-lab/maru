import { processDue } from "@/lib/recruiters/outreachFlow";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Envío diario de los pasos de las secuencias de Maru Recruiters (vercel.json, de lunes a viernes a las 10:00 de Argentina).
 * El primer paso sale al inscribir o activar; éste manda los siguientes cuando vencen.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Falta CRON_SECRET.", code: "NOT_CONFIGURED" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  try {
    const out = await processDue();
    console.log(`[cron/secuencias] ${JSON.stringify(out)}`);
    return Response.json(out);
  } catch (err) {
    console.error("[cron/secuencias] falló", err instanceof Error ? err.message : err);
    return Response.json({ error: "Falló el envío.", code: "FAILED" }, { status: 500 });
  }
}
