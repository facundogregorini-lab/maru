export const runtime = "nodejs";

/**
 * Actualización semanal del catálogo (lunes 07:00 en Argentina): la corre el cron de Vercel (vercel.json) con
 * `Authorization: Bearer CRON_SECRET` y lanza el workflow `match-weekly` de GitHub Actions, que es donde está el
 * inventario. Se dispara desde acá porque el cron de GitHub llega con horas de atraso.
 * Necesita GITHUB_DISPATCH_TOKEN: token fino del repo con permiso "Actions: read and write" y nada más.
 */
const REPO = process.env.MATCH_REPO ?? "facundogregorini-lab/maru";
const WORKFLOW = "match-weekly.yml";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Falta CRON_SECRET.", code: "NOT_CONFIGURED" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "No autorizado.", code: "UNAUTHORIZED" }, { status: 401 });
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return Response.json({ error: "Falta GITHUB_DISPATCH_TOKEN.", code: "NOT_CONFIGURED" }, { status: 503 });
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "content-type": "application/json" },
      body: JSON.stringify({ ref: "main" }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // Nunca se loguea el token: sólo el código de GitHub.
      console.error("[cron/semanal] GitHub respondió", res.status);
      return Response.json({ error: "GitHub no aceptó el pedido.", code: "DISPATCH_FAILED", status: res.status }, { status: 502 });
    }
    console.log("[cron/semanal] match-weekly lanzado");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[cron/semanal]", err instanceof Error ? err.message : "error");
    return Response.json({ error: "No se pudo lanzar la actualización.", code: "UNKNOWN" }, { status: 500 });
  }
}
