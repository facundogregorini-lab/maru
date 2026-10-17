import { createHash } from "node:crypto";
import { createLoginToken, normalizeEmail, safeNext } from "@/lib/auth";
import { dbConfigured, takeCounter } from "@/lib/db";
import { sendMagicLink } from "@/lib/mailer";

export const runtime = "nodejs";

// Freno contra abuso: hasta 5 links por casilla cada 15 minutos (compartido entre instancias si hay base).
// "ana+1@" y "ana+2@" son la misma casilla. Por IP, lo frena el middleware.
const recent = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

async function tooMany(email: string): Promise<boolean> {
  const box = email.replace(/\+[^@]*@/, "@");
  if (dbConfigured()) {
    try {
      return (await takeCounter(`maru:auth:pedidos:${createHash("sha256").update(box).digest("hex").slice(0, 32)}`, MAX_PER_WINDOW, WINDOW_MS)) > 0;
    } catch {
      // base caída: sigue el freno local
    }
  }
  const now = Date.now();
  const hits = (recent.get(box) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(box, hits);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = normalizeEmail(body.email);
  if (!email) return Response.json({ error: "Revisá tu email: parece que tiene un error.", code: "BAD_EMAIL" }, { status: 400 });
  if (await tooMany(email)) {
    return Response.json({ error: "Ya te mandamos varios links. Revisá tu bandeja (y spam) o probá en unos minutos.", code: "RATE_LIMIT" }, { status: 429 });
  }
  try {
    const next = safeNext(body.next);
    const link = `${new URL(req.url).origin}/api/auth/verify?token=${encodeURIComponent(createLoginToken(email))}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`;
    await sendMagicLink(email, link);
  } catch (err) {
    console.error("[auth] no se pudo enviar el magic link:", err instanceof Error ? err.message : err);
    return Response.json({ error: "No pudimos enviarte el email. Probá de nuevo en un rato.", code: "EMAIL_FAILED" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
