import { disableAlert, readUnsubscribeToken } from "@/lib/alerts";

export const runtime = "nodejs";

/** Baja de las alertas sin ingresar: el token firmado del mail alcanza. También recibe la baja en un clic del correo. */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const uid = readUnsubscribeToken(token);
  if (!uid) return Response.json({ error: "El link de baja no es válido.", code: "BAD_TOKEN" }, { status: 400 });
  try {
    await disableAlert(uid);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No pudimos darte de baja. Probá en un momento.", code: "DB_UNAVAILABLE" }, { status: 503 });
  }
}
