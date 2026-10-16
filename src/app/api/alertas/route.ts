import { MAX_ALERTS, addAlert, describeQuery, listAlerts, queryToSearch, removeAlert, type Alert } from "@/lib/alerts";
import { sessionEmail } from "@/lib/auth";
import { dbEnabled } from "@/lib/db";
import { parseJobQuery } from "@/lib/jobFilters";

export const runtime = "nodejs";

/** Para mostrar: con su descripción y el link a la búsqueda. */
const view = (alerts: Alert[]) => alerts.map((a) => ({ id: a.id, label: describeQuery(a.query), href: queryToSearch(a.query) }));

function guard(req: Request): string | Response {
  if (!dbEnabled()) return Response.json({ error: "Las alertas se habilitan muy pronto.", code: "DB_OFF" }, { status: 503 });
  return sessionEmail(req) ?? Response.json({ error: "Ingresá para recibir alertas.", code: "AUTH_REQUIRED" }, { status: 401 });
}

export async function GET(req: Request) {
  const email = guard(req);
  if (email instanceof Response) return email;
  return Response.json({ alerts: view(await listAlerts(email)) }, { headers: { "Cache-Control": "no-store" } });
}

/** Guarda la búsqueda actual (mismos filtros que /busquedas) como alerta diaria. */
export async function POST(req: Request) {
  const email = guard(req);
  if (email instanceof Response) return email;
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const { pagina: _pagina, ...query } = parseJobQuery(body);
  void _pagina;
  const res = await addAlert(email, query);
  if (res === "max") return Response.json({ error: `Podés tener hasta ${MAX_ALERTS} alertas. Borrá alguna desde «Mi cuenta».`, code: "MAX_ALERTS" }, { status: 409 });
  return Response.json({ alerts: view(res) });
}

export async function DELETE(req: Request) {
  const email = guard(req);
  if (email instanceof Response) return email;
  return Response.json({ alerts: view(await removeAlert(email, new URL(req.url).searchParams.get("id"))) });
}
