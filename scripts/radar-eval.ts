/**
 * Evaluación real de radar-match: lee las vacantes reales de empresas P1 de ejemplo, las evalúa con un perfil
 * de PRUEBA (ficticio, sólo para este script) y mide tokens y costo. Base en memoria: no escribe en Upstash.
 *
 *   ANTHROPIC_API_KEY=… npx --yes tsx@4 scripts/radar-eval.ts [salida.md] [--max-ia=60]
 *
 * Lo corre el workflow manual radar-eval (secret ANTHROPIC_API_KEY). Corta si el costo pasa de US$1.
 */
import { writeFileSync } from "node:fs";
import type { UsageReport } from "../src/lib/claude";
import type { MatchPrefs, MatchProfile } from "../src/lib/match/types";
import { EMPTY_PREFS, evaluateForUser } from "../src/lib/radar/match/engine";
import { CRITERIA } from "../src/lib/radar/match/score";
import { detectedOpportunities, follow } from "../src/lib/radar/service";
import { defaultSettings } from "../src/lib/radar/settings";
import { runMonitoring } from "../src/lib/radar/sources/worker";

if (Object.keys(process.env).some((k) => /KV_REST_API|UPSTASH_REDIS/.test(k))) {
  console.error("Hay variables de Upstash: este script sólo corre con la base en memoria.");
  process.exit(1);
}

/** Usuario de prueba del prompt maestro (trayectoria senior en Growth, GTM y estrategia de marketing). Ficticio. */
const PROFILE: MatchProfile = {
  headline: "Head of Growth & GTM",
  titles: ["Head of Growth", "Director de Marketing Strategy", "Growth Manager", "Gerente de Operaciones Comerciales"],
  skills: ["growth", "go-to-market", "estrategia de marketing", "marketing digital", "seo", "performance marketing", "sql", "analytics", "liderazgo de equipos", "operaciones", "b2b", "saas", "experimentación", "lifecycle marketing"],
  languages: [{ language: "español", level: "nativo" }, { language: "inglés", level: "avanzado" }],
  yearsExperience: 14,
  location: "",
  summary: "Lideré growth, GTM y estrategia de marketing en startups B2B y scaleups de LatAm, con equipos de hasta 10 personas, presupuesto propio y foco en adquisición, activación y expansión.",
  leadership: { teamSize: 10, evidence: ["equipos de hasta 10 personas"] },
};
const PREFS: MatchPrefs = { ...EMPTY_PREFS, rolesDeseados: ["Head of Growth", "Director of Marketing", "GTM Lead", "Growth Lead"], seniorities: ["lead", "manager", "director", "ejecutivo"], carrera: "continuidad" };

const COMPANIES: [string, string][] = [
  ["Supabase", "https://jobs.ashbyhq.com/supabase"],
  ["Vercel", "https://job-boards.greenhouse.io/vercel"],
  ["ElevenLabs", "https://jobs.ashbyhq.com/elevenlabs"],
  ["Linear", "https://jobs.ashbyhq.com/linear"],
  ["PostHog", "https://jobs.ashbyhq.com/posthog"],
  ["Lovable", "https://job-boards.greenhouse.io/lovable"],
  ["n8n", "https://jobs.ashbyhq.com/n8n"],
];

const out = process.argv.find((a) => a.endsWith(".md")) ?? "radar-eval.md";
const maxIa = Number(process.argv.find((a) => a.startsWith("--max-ia="))?.split("=")[1]) || 60;
const COST_CAP = 1;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY.");
    process.exit(1);
  }
  const uid = "radar-eval-prueba";
  for (const [name, url] of COMPANIES) await follow(uid, { create: { name, careersUrl: url }, priority: "P1" });
  const run = await runMonitoring({ trigger: "script", budgetMs: 240_000 });

  const settings = { ...defaultSettings(), eligibility: { authorizedCountries: ["AR"], relocation: "a_conversar" as const, remote: "cualquiera" as const, minMonthlyUsd: 6000 } };
  const usage: UsageReport[] = [];
  let usd = 0;
  const t0 = Date.now();
  const res = await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings, {
    maxLlm: maxIa,
    dailyLimit: 10_000,
    onUsage: (u) => {
      usage.push(u);
      usd += u.usd;
      if (usd > COST_CAP) throw new Error("Tope de costo alcanzado");
    },
  });
  const secs = Math.round((Date.now() - t0) / 1000);
  const o = await detectedOpportunities(uid);
  const evaluated = o.jobs.filter((j) => j.match && j.match.score !== null);
  const blocked = evaluated.filter((j) => j.match!.eligibility === "blocked").length;
  const verify = evaluated.filter((j) => j.match!.eligibility === "needs_verification").length;
  const top = o.jobs.filter((j) => j.action).slice(0, 5);
  const tokIn = usage.reduce((a, u) => a + u.entrada, 0);
  const tokOut = usage.reduce((a, u) => a + u.salida, 0);
  const perEval = res.ia ? usd / res.ia : 0;
  // Estimación semanal: vacantes nuevas o modificadas ≈ 15 % de las abiertas, con la misma proporción que pasa a la IA.
  const iaShare = res.ia + res.rules ? res.ia / (res.ia + res.rules) : 0;
  const weeklyNew = Math.round(o.jobs.length * 0.15);
  const weeklyCost = weeklyNew * iaShare * perEval;

  const lines = [
    `# radar-match: evaluación real (${new Date().toISOString().slice(0, 10)})`,
    "",
    "Perfil de prueba ficticio (senior Growth/GTM). Elegibilidad declarada: Argentina, relocalización a conversar, mínimo USD 6.000 por mes.",
    "",
    `- Fuentes leídas: ${run.totals.sources} (${run.totals.ok} bien, ${run.totals.errors} con error); vacantes abiertas: **${o.jobs.length}**.`,
    `- Evaluadas: **${res.ia} con IA**, ${res.rules} descartadas por reglas (función, nivel o bloqueo), ${res.pendingIa} quedaron fuera del tope de ${maxIa}, ${res.failed} fallidas.`,
    `- Con score: ${evaluated.length}. **Bloqueadas: ${blocked}. Por verificar: ${verify}.**`,
    `- Tokens: ${tokIn} de entrada y ${tokOut} de salida en ${usage.length} llamadas (${secs} s). Costo: **US$${usd.toFixed(4)}**, **US$${perEval.toFixed(5)} por vacante evaluada con IA**.`,
    `- Estimación por usuario activo y semana (7 empresas P1, ~15 % de vacantes nuevas o modificadas, ${Math.round(iaShare * 100)} % pasa a la IA): ~${weeklyNew} vacantes, **US$${weeklyCost.toFixed(4)}**.`,
    "",
    "## Top 5 por prioridad de acción",
    "",
  ];
  for (const [i, j] of top.entries()) {
    const m = j.match!;
    lines.push(`### ${i + 1}. ${j.companyName} · ${j.title}`, "", `Match **${m.score}/100** · prioridad ${j.action!.band} (${j.action!.value}) · ${m.eligibility} · confianza ${m.confidence} · cobertura ${Math.round(m.coverage * 100)} %`, "", `> ${m.mainReason}`, "");
    if (m.mainBarrier) lines.push(`Barrera: ${m.mainBarrier}`, "");
    lines.push("| Criterio | Peso | Puntaje | Evidencia |", "|---|---|---|---|");
    for (const c of m.breakdown) lines.push(`| ${CRITERIA.find((x) => x.id === c.id)?.label} | ${c.weight} | ${c.known ? c.score : "sin dato"} | ${c.evidence.join("; ").replace(/\|/g, "/")} |`);
    lines.push("", `Prioridad: ${j.action!.why.join(" · ")}`, "");
  }
  writeFileSync(out, lines.join("\n"));
  console.log(lines.join("\n"));
}

void main();
