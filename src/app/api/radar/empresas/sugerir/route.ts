import { takeCounter } from "@/lib/db";
import { findCandidates } from "@/lib/radar/enrich";
import { json, radarRoute } from "@/lib/radar/http";

/** Autocompletar de «Agregar empresa» con IA: GET ?q= → hasta 5 empresas reales que pudo haber querido escribir. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAILY = 120;

export const GET = radarRoute(async ({ req, uid }) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 3) return json({ results: [] });
  // Tope diario por persona (cada consulta nueva es una llamada corta a Haiku).
  const wait = await takeCounter(`maru:radar:v1:u:${uid}:sugerir`, DAILY, 86_400_000);
  if (wait) return json({ results: [], limited: true });
  return json({ results: await findCandidates(q) });
});
