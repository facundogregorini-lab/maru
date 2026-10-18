import { OAUTH_COOKIE, createSessionToken, normalizeEmail, readCookie, readOAuthState, sessionCookie } from "@/lib/auth";
import { googleEmail } from "@/lib/google";

export const runtime = "nodejs";

const clearState = `${OAUTH_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0`;

/** Google vuelve acá: valida el estado (firmado y de este navegador), obtiene el email y deja la sesión. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = readOAuthState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  const next = state?.next ?? "/";
  const popup = state?.popup ?? false;

  let email: string | null = null;
  if (state && code && readCookie(req, OAUTH_COOKIE) === state.n) {
    try {
      email = normalizeEmail(await googleEmail(url.origin, code));
    } catch (err) {
      console.error("[auth] ingreso con Google:", err instanceof Error ? err.message : err);
    }
  }

  const headers = new Headers();
  headers.append("Set-Cookie", clearState);
  if (email) headers.append("Set-Cookie", sessionCookie(createSessionToken(email)));

  const back = new URL(next, url.origin);
  back.searchParams.set("ingreso", email ? "ok" : "google-error");
  if (!popup) {
    headers.set("Location", back.toString());
    return new Response(null, { status: 303, headers });
  }
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(popupPage(Boolean(email), back.toString()), { status: 200, headers });
}

/** Ventana de Google: avisa a la pestaña de Maru (que retoma lo que estaba haciendo) y se cierra. */
function popupPage(ok: boolean, back: string): string {
  const msg = ok ? "¡Listo! Ya entraste a Maru. Podés cerrar esta ventana." : "No pudimos ingresar con Google. Cerrá esta ventana y probá de nuevo.";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maru</title></head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif;background:#f5f6f7;color:#111">
<div style="max-width:320px;padding:24px;text-align:center"><p style="font-size:16px;line-height:1.5">${msg}</p>
<p><a href="${back.replace(/"/g, "&quot;")}" style="color:#111">Volver a Maru</a></p></div>
<script>
try { new BroadcastChannel("maru-auth").postMessage(${JSON.stringify(ok ? "ok" : "error")}); } catch (e) {}
setTimeout(function () { window.close(); }, ${ok ? 300 : 2500});
</script></body></html>`;
}
