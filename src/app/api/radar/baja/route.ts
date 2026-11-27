import { radarFlagOn } from "@/lib/radar/flag";
import { notFound } from "@/lib/radar/http";
import { readUnsubscribeToken } from "@/lib/radar/notify";
import { radarRepos } from "@/lib/radar/repo";
import { readSettings } from "@/lib/radar/service";

/**
 * Baja del email de Radar sin ingresar. GET: página con el botón (los antivirus abren los links, así que el GET
 * no cambia nada). POST: la baja (también la de un clic de los clientes de correo, List-Unsubscribe-Post).
 */

export const runtime = "nodejs";

const page = (body: string) =>
  new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Radar laboral · Maru</title></head><body style="font-family:Arial,sans-serif;max-width:480px;margin:48px auto;padding:0 16px">${body}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  if (!radarFlagOn()) return notFound();
  const t = new URL(req.url).searchParams.get("t");
  if (!readUnsubscribeToken(t)) return page("<p>El link no es válido.</p>");
  return page(`<h1 style="font-size:20px">Dejar de recibir Radar por email</h1><p>Vas a seguir viendo tus avisos dentro de Maru.</p><form method="post"><input type="hidden" name="t" value="${encodeURIComponent(t!)}"><button type="submit" style="padding:10px 18px;border-radius:999px;background:#000;color:#fff;border:0">Confirmar</button></form>`);
}

export async function POST(req: Request) {
  if (!radarFlagOn()) return notFound();
  const url = new URL(req.url);
  let t = url.searchParams.get("t");
  if (!t) {
    const form = await req.formData().catch(() => null);
    const v = form?.get("t");
    t = typeof v === "string" ? decodeURIComponent(v) : null;
  }
  const uid = readUnsubscribeToken(t);
  if (!uid) return page("<p>El link no es válido.</p>");
  const repos = radarRepos();
  const settings = await readSettings(uid);
  await repos.settings.write(uid, { ...settings, channels: { ...settings.channels, email: false } });
  await repos.user.setContact(uid, null);
  return page("<h1 style=\"font-size:20px\">Listo</h1><p>No vas a recibir más emails de Radar. Podés volver a activarlos en Automatización.</p>");
}
