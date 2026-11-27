import { json, radarRoute, readJson } from "@/lib/radar/http";
import { radarRepos } from "@/lib/radar/repo";
import { readSettings } from "@/lib/radar/service";
import { parseSettings } from "@/lib/radar/settings";

/** Ajustes de monitoreo. GET: los guardados (o los de fábrica). PUT: guarda. En esta etapa no ejecutan nada. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => json({ settings: await readSettings(uid) }));

export const PUT = radarRoute(async ({ req, uid, email }) => {
  const parsed = parseSettings(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error, code: "BAD_REQUEST" }, 400);
  const repos = radarRepos();
  await repos.settings.write(uid, parsed.settings);
  // El email sólo se guarda para Radar si la persona lo aceptó; si lo apaga, se borra.
  await repos.user.setContact(uid, parsed.settings.channels.email ? email : null);
  // Pausar cancela lo que estaba por salir.
  if (!parsed.settings.enabled) {
    const outbox = await repos.user.outbox(uid);
    let n = 0;
    for (const it of Object.values(outbox.items)) if (it.status === "pending") { it.status = "cancelled"; n++; }
    if (n) await repos.user.saveOutbox(uid, { ...outbox, updatedAt: Date.now() });
  }
  return json({ settings: parsed.settings });
});
