import { z } from "zod";
import { notifyRecruiter, readResponseToken } from "@/lib/recruiters/outreach";
import { respond } from "@/lib/recruiters/outreachFlow";

export const runtime = "nodejs";

const Body = z.object({ t: z.string().min(10).max(300), r: z.enum(["si", "no", "baja"]) });

/**
 * Respuesta de un candidato a un mensaje de Maru Recruiters (botones del mail). Es un POST desde la página
 * /recruiters/respuesta, no un GET del link: los antivirus del correo abren los links solos y no deben contestar por la persona.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "El link no es válido.", code: "BAD_REQUEST" }, { status: 400 });
  const ids = readResponseToken(parsed.data.t);
  if (!ids) return Response.json({ error: "El link no es válido o venció.", code: "BAD_TOKEN" }, { status: 400 });
  try {
    const out = await respond({ ...ids, r: parsed.data.r, notify: notifyRecruiter });
    if (!out.ok) return Response.json({ error: "Esta búsqueda ya no está activa.", code: "GONE" }, { status: 410 });
    return Response.json({ ok: true, empresa: out.empresa });
  } catch {
    return Response.json({ error: "No pudimos guardar tu respuesta. Probá en un momento.", code: "DB_UNAVAILABLE" }, { status: 503 });
  }
}
