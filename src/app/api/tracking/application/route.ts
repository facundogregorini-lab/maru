import { sessionEmail } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { readDocs, writeDoc } from "@/lib/sync/server";
import { upsertInto, type TrackItem } from "@/lib/tracker";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(300),
  company: z.string().max(200).optional(),
  ats: z.string().max(40).optional(),
});

/**
 * La extensión detectó que la persona envió una postulación y ella eligió guardarla: suma la tarjeta como
 * "Postulada" al seguimiento de su cuenta (el mismo documento que ya se sincroniza). Sin sesión, 401:
 * la extensión abre /seguimiento?add= como antes.
 */
export async function POST(req: Request) {
  let email: string | null = null;
  try { email = sessionEmail(req); } catch { email = null; }
  if (!email) return Response.json({ error: "Ingresá en Maru para guardar en tu seguimiento.", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!dbConfigured()) return Response.json({ error: "El seguimiento en la cuenta no está disponible.", code: "SYNC_UNAVAILABLE" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Faltan datos de la postulación.", code: "BAD_REQUEST" }, { status: 400 });
  const { url, title, company } = parsed.data;
  for (let attempt = 0; attempt < 3; attempt++) {
    const stored = (await readDocs(email)).tracker;
    const items = Array.isArray(stored?.data) ? (stored.data as TrackItem[]) : [];
    const out = upsertInto(items, { title: title.trim() || "Postulación", company: company?.trim() ?? "", jobUrl: url, status: "postulada" });
    if (!out) break;
    const res = await writeDoc(email, "tracker", out.items, stored?.updatedAt ?? 0);
    if (res.ok) return Response.json({ ok: true, id: out.item.id });
  }
  return Response.json({ error: "No pudimos guardar en tu seguimiento. Probá de nuevo.", code: "SYNC_CONFLICT" }, { status: 409 });
}
