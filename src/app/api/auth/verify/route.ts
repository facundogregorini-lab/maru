import { createHash } from "node:crypto";
import { createSessionToken, LOGIN_TTL_S, safeNext, sessionCookie, verifyLoginToken } from "@/lib/auth";
import { dbConfigured, takeCounter } from "@/lib/db";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function expired(url: URL, next: string): Response {
  const home = new URL(next, url.origin);
  home.searchParams.set("ingreso", "vencido");
  return Response.redirect(home, 303);
}

/**
 * El link del email apunta acá. Abrirlo no crea la sesión: muestra con qué cuenta vas a entrar y un botón.
 * Así un link ajeno no te deja logueado en la cuenta de otra persona (donde subirían tus datos), y los
 * escáneres de correo que abren links no lo gastan.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeNext(url.searchParams.get("next"));
  const email = verifyLoginToken(token);
  if (!email) return expired(url, next);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Entrar a Maru</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f7;font-family:system-ui,-apple-system,sans-serif;color:#111}main{max-width:380px;margin:16px;padding:28px;border-radius:24px;background:#fff;text-align:center}h1{font-size:22px;margin:0 0 8px}p{color:#555;line-height:1.5;margin:0 0 20px}strong{color:#111;word-break:break-all}button{width:100%;padding:14px;border:0;border-radius:999px;background:#111;color:#fff;font-size:16px;font-weight:700;cursor:pointer}small{display:block;margin-top:16px;color:#777;line-height:1.4}</style></head>
<body><main><h1>Entrar a Maru</h1><p>Vas a entrar como <strong>${esc(email)}</strong>.</p>
<form method="post" action="/api/auth/verify"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="next" value="${esc(next)}"><button type="submit">Entrar</button></form>
<small>Si no pediste este link o no es tu email, cerrá esta página: no pasa nada.</small></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" } });
}

/** El botón de la página de arriba: crea la sesión. Sólo desde el propio sitio y una vez por link. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Pedido inválido.", { status: 403 });
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const next = safeNext(String(form?.get("next") ?? "/"));
  const email = verifyLoginToken(token);
  if (!email) return expired(url, next);
  // Un link sirve una sola vez (si hay base; sin base, sigue valiendo hasta que vence).
  if (dbConfigured()) {
    const id = createHash("sha256").update(token).digest("hex").slice(0, 32);
    try {
      if (await takeCounter(`maru:auth:usado:${id}`, 1, LOGIN_TTL_S * 1000)) return expired(url, next);
    } catch {
      // Base caída: no bloqueamos el ingreso por eso.
    }
  }
  const home = new URL(next, url.origin);
  home.searchParams.set("ingreso", "ok");
  return new Response(null, { status: 303, headers: { Location: home.toString(), "Set-Cookie": sessionCookie(createSessionToken(email)) } });
}
