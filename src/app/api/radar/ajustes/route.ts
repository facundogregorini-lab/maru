import { json, radarRoute, readJson } from "@/lib/radar/http";
import { radarRepos } from "@/lib/radar/repo";
import { readSettings } from "@/lib/radar/service";
import { parseSettings } from "@/lib/radar/settings";

/** Ajustes de monitoreo. GET: los guardados (o los de fábrica). PUT: guarda. En esta etapa no ejecutan nada. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => json({ settings: await readSettings(uid) }));

export const PUT = radarRoute(async ({ req, uid }) => {
  const parsed = parseSettings(await readJson(req));
  if (!parsed.ok) return json({ error: parsed.error, code: "BAD_REQUEST" }, 400);
  await radarRepos().settings.write(uid, parsed.settings);
  return json({ settings: parsed.settings });
});
