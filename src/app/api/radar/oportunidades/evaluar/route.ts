import { dbConfigured } from "@/lib/db";
import type { MatchState } from "@/lib/match/clientStore";
import { json, radarRoute } from "@/lib/radar/http";
import { NoProfileError, evaluateForUser } from "@/lib/radar/match/engine";
import { readSettings } from "@/lib/radar/service";
import { readDocs } from "@/lib/sync/server";

/**
 * Evaluar las vacantes detectadas con radar-match. El perfil sale del Match de la persona (sincronizado con su
 * cuenta). Sólo evalúa lo nuevo o lo que cambió; tope por llamada y cupo diario de evaluaciones con IA.
 */

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = radarRoute(async ({ uid, email }) => {
  if (!dbConfigured()) return json({ error: "La base de datos no está conectada.", code: "DB_NOT_CONFIGURED" }, 503);
  const docs = await readDocs(email);
  const state = (docs.match?.data ?? null) as MatchState | null;
  try {
    const result = await evaluateForUser(uid, { profile: state?.profile ?? null, prefs: state?.prefs ?? null }, await readSettings(uid), { maxLlm: 30 });
    return json({ result });
  } catch (err) {
    if (err instanceof NoProfileError) return json({ error: err.message, code: err.code }, 409);
    throw err;
  }
});
