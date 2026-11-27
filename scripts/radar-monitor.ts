/**
 * Corrida real de Radar contra fuentes públicas, en memoria (no escribe en Upstash).
 *
 *   npx --yes tsx@4 scripts/radar-monitor.ts            # valida y lee la lista de ejemplo
 *   npx --yes tsx@4 scripts/radar-monitor.ts --resolve  # sólo resuelve ATS/board, sin leer vacantes
 *   npx --yes tsx@4 scripts/radar-monitor.ts --only=Anthropic,Supabase
 *
 * Si hay variables de Upstash en el entorno se niega a correr: Preview y Production comparten la base.
 */
import { resolveSource } from "../src/lib/radar/sources/resolve";
import { runMonitoring } from "../src/lib/radar/sources/worker";
import { follow, listTargets } from "../src/lib/radar/service";
import { radarRepos } from "../src/lib/radar/repo";

if (Object.keys(process.env).some((k) => /KV_REST_API|UPSTASH_REDIS/.test(k))) {
  console.error("Hay variables de Upstash: este script sólo corre con la base en memoria.");
  process.exit(1);
}

/** P1 de ejemplo (prompt maestro y prototipo): el Sheet real no está en el repo. */
export const SAMPLE: [string, string][] = [
  ["Anthropic", "https://www.anthropic.com/careers"],
  ["OpenAI", "https://openai.com/careers"],
  ["ElevenLabs", "https://elevenlabs.io/careers"],
  ["Supabase", "https://supabase.com/careers"],
  ["Humand", "https://careers.humand.co/jobs"],
  ["The Exploration Company", "https://www.exploration.space/careers"],
  ["Vercel", "https://vercel.com/careers"],
  ["PostHog", "https://posthog.com/careers"],
  ["Mistral AI", "https://mistral.ai/careers"],
  ["PLD Space", "https://www.pldspace.com/en/careers"],
  ["ICEYE", "https://www.iceye.com/careers"],
  ["Linear", "https://linear.app/careers"],
  ["Lovable", "https://lovable.dev/careers"],
  ["Clay", "https://www.clay.com/careers"],
  ["n8n", "https://n8n.io/careers"],
  ["Stripe", "https://stripe.com/jobs"],
  ["NotCo", "https://notco.com/careers"],
  ["Satellogic", "https://satellogic.com/careers"],
  ["Mercado Libre", "https://careers-meli.mercadolibre.com"],
  ["Ualá", "https://www.uala.com.ar/trabaja-con-nosotros"],
];

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}`));
const only = arg("only")?.split("=")[1]?.split(",").map((s) => s.trim().toLowerCase());
const list = SAMPLE.filter(([n]) => !only || only.includes(n.toLowerCase()));

async function main() {
  if (arg("resolve")) {
    for (const [name, url] of list) {
      const r = await resolveSource(url, {}, { companyName: name });
      console.log([name, url, r.provider, r.externalBoardId ?? "", r.region ?? "", r.status, r.statusNote ?? ""].join(" | "));
    }
    return;
  }
  const uid = "script-demo";
  for (const [name, url] of list) await follow(uid, { create: { name, careersUrl: url }, priority: "P1" });
  const t0 = Date.now();
  const run = await runMonitoring({ trigger: "script", budgetMs: 240_000 });
  const views = (await listTargets(uid)).items;
  for (const v of views) {
    const s = v.sources[0];
    const item = run.items.find((i) => i.sourceId === s?.id);
    console.log([v.company.name, s?.provider, s?.externalBoardId ?? "", s?.status, `recibidas=${item?.received ?? 0}`, `abiertas=${s?.openJobs ?? 0}`, `nuevas=${item?.created ?? 0}`, `intentos=${item?.attempts ?? 0}`, `${item?.durationMs ?? 0}ms`, s?.statusNote ?? ""].join(" | "));
  }
  // Segunda corrida: idempotencia (sin red nueva de usuarios; mismas fuentes).
  const run2 = await runMonitoring({ trigger: "script", budgetMs: 240_000 });
  console.log(`\nCorrida 1: ${JSON.stringify(run.totals)} en ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(`Corrida 2: ${JSON.stringify(run2.totals)}`);
  const idx = await radarRepos().jobs.readIndexes(views.flatMap((v) => v.sources.map((s) => s.id)));
  console.log(`Vacantes en el índice: ${idx.reduce((n, d) => n + (d ? Object.keys(d.jobs).length : 0), 0)}`);
}

void main();
