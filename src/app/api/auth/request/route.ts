import { createLoginToken, normalizeEmail } from "@/lib/auth";
import { sendMagicLink } from "@/lib/mailer";

export const runtime = "nodejs";

// Freno simple contra abuso (por instancia): hasta 5 links por email cada 15 minutos.
const recent = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function tooMany(email: string): boolean {
  const now = Date.now();
  const hits = (recent.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(email, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Revisá tu email: parece que tiene un error.", code: "BAD_EMAIL" }, { status: 400 });
  if (tooMany(email)) {
    return Response.json({ error: "Ya te mandamos varios links. Revisá tu bandeja (y spam) o probá en unos minutos.", code: "RATE_LIMIT" }, { status: 429 });
  }
  try {
    const link = `${new URL(req.url).origin}/api/auth/verify?token=${encodeURIComponent(createLoginToken(email))}`;
    await sendMagicLink(email, link);
  } catch (err) {
    console.error("[auth] no se pudo enviar el magic link:", err instanceof Error ? err.message : err);
    return Response.json({ error: "No pudimos enviarte el email. Probá de nuevo en un rato.", code: "EMAIL_FAILED" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
