import { json, radarRoute, readJson } from "@/lib/radar/http";
import { radarRepos } from "@/lib/radar/repo";

/** Avisos in-app de Radar (alertas y resúmenes). GET: la lista. POST {id} o {all: true}: marcar leídos. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => {
  const doc = await radarRepos().user.notifications(uid);
  return json({ items: doc.items.slice(0, 50), unread: doc.items.filter((n) => !n.read).length });
});

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const repos = radarRepos();
  const doc = await repos.user.notifications(uid);
  const id = typeof body.id === "string" ? body.id : null;
  doc.items = doc.items.map((n) => (body.all === true || n.id === id ? { ...n, read: true } : n));
  await repos.user.saveNotifications(uid, { ...doc, updatedAt: Date.now() });
  return json({ unread: doc.items.filter((n) => !n.read).length });
});
