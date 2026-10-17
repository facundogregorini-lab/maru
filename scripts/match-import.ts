/**
 * Importa avisos de proveedores con cuota al inventario compartido (docs/IMPORTACIONES.md).
 *
 *   npx --yes tsx@4 scripts/match-import.ts --provider=fantastic --mode=plan       # sin red (default)
 *   npx --yes tsx@4 scripts/match-import.ts --provider=serpapi --mode=status       # saldo, sin consumir avisos
 *   npx --yes tsx@4 scripts/match-import.ts --provider=apify --mode=run --budget-usd=5
 *
 * Claves sólo por entorno: FANTASTIC_JOBS, SERP_API, APIFY_TOKEN (secrets de GitHub Actions).
 * Escribe data/match/inventory.json, providers-ledger.json (consumo, sin claves) y
 * providers-discoveries.json (empleadores vistos que podrían sumarse gratis al directorio).
 * Lo corre a mano el workflow .github/workflows/match-providers.yml; nunca la sync diaria.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { APIFY_JOBS, APIFY_KEYWORDS, apifyJobInput, apifyNextCap, normalizeApifyJobs, type ApifyJobSource } from "../src/lib/match/apify";
import { applyBoard, buildOpportunities, emptyInventory, forStorage, opportunitiesOf, recordRun } from "../src/lib/match/inventory";
import { fantasticQuota, request, serpAccount } from "../src/lib/match/provider-pilot";
import { FANTASTIC_COHORTS, runFantastic, runSerp, SERP_QUERIES, type Employer, type ImportResult, type LedgerEntry } from "../src/lib/match/providers";
import type { BoardSyncResult, Inventory, NormalizedPosting } from "../src/lib/match/types";

const DATA = path.join(process.cwd(), "data", "match");
const INV = path.join(DATA, "inventory.json");
const STATE = path.join(DATA, "sync-state.json");
const LEDGER = path.join(DATA, "providers-ledger.json");
const DISCOVERIES = path.join(DATA, "providers-discoveries.json");

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)?.trim();
const num = (name: string, fallback: number) => {
  const raw = arg(name);
  const n = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} inválido.`);
  return n;
};
const csv = (name: string, fallback: string[]) => (arg(name) ? arg(name)!.split(",").map((s) => s.trim()).filter(Boolean) : fallback);

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(file: string, data: unknown, pretty = false) {
  await writeFile(`${file}.tmp`, JSON.stringify(data, null, pretty ? 2 : undefined) + "\n");
  await rename(`${file}.tmp`, file);
}

const secrets = () => ["FANTASTIC_JOBS", "SERP_API", "APIFY_TOKEN"].map((k) => process.env[k]).filter((v): v is string => !!v && v.length > 6);
const redact = (s: string) => secrets().reduce((acc, k) => acc.replaceAll(k, "[redacted]"), s);
const log = (m: string) => console.log(redact(m));
const summary: string[] = [];

function key(name: "FANTASTIC_JOBS" | "SERP_API" | "APIFY_TOKEN"): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Falta el secret ${name} en GitHub Actions (Settings → Secrets and variables → Actions).`);
  return v;
}

/* ---------- Apify por REST (sin dependencias): inicio con tope, espera, dataset con campos elegidos ---------- */

async function apifyFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`Apify respondió HTTP ${res.status}.`);
  return (await res.json()) as { data?: Record<string, unknown> } & unknown[];
}

async function runApify(token: string, sources: ApifyJobSource[], rows: number, budgetUsd: number, spentBefore: number, keywordsPerSource: number, nowIso: string): Promise<ImportResult> {
  const out: ImportResult = { batches: [], ledger: [], employers: [], stopped: null };
  let spent = spentBefore;
  for (const source of sources) {
    const config = APIFY_JOBS[source];
    for (const keyword of APIFY_KEYWORDS[source].slice(0, keywordsPerSource)) {
      const cap = apifyNextCap(source, rows, spent, budgetUsd);
      if (!cap) {
        out.stopped = `Presupuesto Apify: gastado ~US$${spent.toFixed(3)} de US$${budgetUsd}; la próxima corrida podría pasarse.`;
        return out;
      }
      const input = apifyJobInput(source, keyword, rows, 200);
      const params = { actor: config.actor, keyword, rows: String(rows), maxTotalChargeUsd: String(cap) };
      try {
        const actor = config.actor.replace("/", "~");
        const started = await apifyFetch(`https://api.apify.com/v2/acts/${actor}/runs?maxItems=${rows}&maxTotalChargeUsd=${cap}&timeout=300&waitForFinish=60`, token, { method: "POST", body: JSON.stringify(input) });
        let run = started.data ?? {};
        for (let i = 0; i < 8 && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(String(run.status)); i++) {
          run = (await apifyFetch(`https://api.apify.com/v2/actor-runs/${run.id}?waitForFinish=60`, token)).data ?? {};
        }
        const usage = typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : 0;
        if (run.status !== "SUCCEEDED") {
          // Lo que haya costado igual cuenta, aunque no importemos nada.
          spent += Math.max(usage, cap);
          out.ledger.push({ at: nowIso, provider: "apify", call: "run", params: { ...params, runId: String(run.id ?? "") }, rows: 0, consumed: Math.max(usage, cap), quota: { status: String(run.status ?? "desconocido") }, error: "Ejecución incompleta: no se importa." });
          log(`✗ ${source} "${keyword}": ${run.status}.`);
          continue;
        }
        // La API de datasets sólo filtra campos de primer nivel: "companyDetails.name" se pide como "companyDetails".
        const fields = [...new Set(config.fields.map((f) => f.split(".")[0]))].join(",");
        const items = (await apifyFetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=${rows}&fields=${encodeURIComponent(fields)}`, token)) as unknown as unknown[];
        const list = Array.isArray(items) ? items.slice(0, rows) : [];
        // Costo conservador: uso de plataforma + precio por fila (puede sobreestimar, nunca subestimar).
        const cost = Math.round((usage + list.length * (cap / rows)) * 10000) / 10000;
        spent += cost;
        const normalized = normalizeApifyJobs(source, list, nowIso);
        out.batches.push({ sourceId: `apify-${source}`, boardId: `apify:${source}:ar`, postings: normalized.postings, received: list.length, rejected: normalized.rejected, query: keyword });
        out.ledger.push({ at: nowIso, provider: "apify", call: "run", params: { ...params, runId: String(run.id), datasetId: String(run.defaultDatasetId) }, rows: list.length, consumed: cost, quota: { usageTotalUsd: usage, spentUsd: Math.round(spent * 1000) / 1000, budgetUsd } });
        log(`✓ ${source} "${keyword}": ${list.length} filas, ${normalized.accepted} aceptadas, ~US$${cost.toFixed(3)} (acumulado ~US$${spent.toFixed(3)}).`);
        // Diagnóstico sin datos del aviso: si nada pasa, sólo los nombres de campo que llegaron.
        if (list.length && !normalized.accepted) log(`  campos recibidos: ${Object.keys(Object(list[0])).sort().join(", ")} · rechazos ${JSON.stringify(normalized.rejected)}`);
      } catch (e) {
        spent += cap;
        out.ledger.push({ at: nowIso, provider: "apify", call: "run", params, rows: 0, consumed: cap, quota: {}, error: redact((e as Error).message) });
        out.stopped = `${source} "${keyword}": ${redact((e as Error).message)}`;
        return out;
      }
    }
  }
  return out;
}

/* ---------- main ---------- */

async function main() {
  const provider = arg("provider");
  const mode = arg("mode") ?? "plan";
  if (!["fantastic", "serpapi", "apify"].includes(provider ?? "")) throw new Error("Elegí --provider=fantastic, serpapi o apify.");
  if (!["plan", "status", "run"].includes(mode)) throw new Error("--mode debe ser plan, status o run.");
  const nowIso = new Date().toISOString();
  const ledger = await readJson<{ entries: LedgerEntry[] }>(LEDGER, { entries: [] });

  const fantasticPlan = { cohorts: csv("cohorts", FANTASTIC_COHORTS.map((c) => c.id)), feeds: csv("feeds", ["ats", "jb"]).map((f) => (f === "jb" ? "fantastic_jb" : "fantastic_ats")) as ("fantastic_ats" | "fantastic_jb")[], limit: num("limit", 50), maxJobs: num("max-jobs", 300), timeFrame: (arg("time-frame") ?? "7d") as "24h" | "7d" | "1m", offset: num("offset", 0) };
  const queryIds = csv("queries", SERP_QUERIES.map((q) => q.id));
  const serpPlan = { queries: SERP_QUERIES.filter((q) => queryIds.includes(q.id)), maxSearches: num("max-searches", 12), reserve: num("reserve", 20) };
  const apifySources = csv("sources", ["computrabajo", "indeed", "linkedin"]).filter((s): s is ApifyJobSource => Object.hasOwn(APIFY_JOBS, s));
  const apifyRows = Math.min(200, Math.max(1, num("rows", 100)));
  const apifyBudget = num("budget-usd", 0);
  const apifySpent = ledger.entries.filter((e) => e.provider === "apify").reduce((a, e) => a + (e.consumed ?? 0), 0);

  if (mode === "plan") {
    const plan = provider === "fantastic" ? fantasticPlan : provider === "serpapi" ? serpPlan : { sources: apifySources, rows: apifyRows, keywords: APIFY_KEYWORDS, budgetUsd: apifyBudget, spentUsd: apifySpent };
    log(JSON.stringify({ mode, provider, plan }, null, 2));
    return;
  }

  if (mode === "status") {
    if (provider === "serpapi") log(JSON.stringify(await serpAccount(key("SERP_API"))));
    else if (provider === "fantastic") {
      // Un request de conteo: no consume créditos de avisos.
      const url = new URL("https://data.fantastic.jobs/v1/active-ats-count");
      url.searchParams.set("time_frame", "7d");
      url.searchParams.set("location", "Argentina");
      const res = await request(url, { Authorization: `Bearer ${key("FANTASTIC_JOBS")}` });
      log(JSON.stringify({ count7dArgentinaAts: (res.body as { count?: number }).count ?? null, quota: fantasticQuota(res.headers) }));
    } else {
      const me = await apifyFetch("https://api.apify.com/v2/users/me/limits", key("APIFY_TOKEN"));
      const d = (me.data ?? {}) as Record<string, Record<string, unknown>>;
      log(JSON.stringify({ monthlyUsageUsd: d.current?.monthlyUsageUsd ?? null, maxMonthlyUsageUsd: d.limits?.maxMonthlyUsageUsd ?? null, ledgerSpentUsd: Math.round(apifySpent * 1000) / 1000 }));
    }
    return;
  }

  // run: respetamos el lock de la sincronización diaria.
  const state = await readJson<{ lock: { owner: string } | null }>(STATE, { lock: null });
  if (state.lock) throw new Error(`Hay una sincronización en curso (${state.lock.owner}); probá más tarde.`);

  let result: ImportResult;
  if (provider === "fantastic") result = await runFantastic(key("FANTASTIC_JOBS"), fantasticPlan, log, nowIso);
  else if (provider === "serpapi") result = await runSerp(key("SERP_API"), serpPlan, log, nowIso);
  else {
    if (!(apifyBudget > 0 && apifyBudget <= 5)) throw new Error("Indicá --budget-usd entre 0 y 5 (presupuesto aprobado por el dueño).");
    result = await runApify(key("APIFY_TOKEN"), apifySources, apifyRows, apifyBudget, apifySpent, num("keywords-per-source", 10), nowIso);
  }

  const inv = await readJson<Inventory>(INV, emptyInventory("real"));
  if (inv.kind !== "real") throw new Error("inventory.json no es un inventario real.");
  const totals = { created: 0, updated: 0, unchanged: 0, closed: 0 };
  const boards: BoardSyncResult[] = [];
  const byBoard = new Map<string, { sourceId: string; postings: NormalizedPosting[]; received: number }>();
  for (const b of result.batches) {
    const acc = byBoard.get(b.boardId) ?? { sourceId: b.sourceId, postings: [], received: 0 };
    acc.postings.push(...b.postings);
    acc.received += b.received;
    byBoard.set(b.boardId, acc);
  }
  for (const [boardId, b] of byBoard) {
    const s = applyBoard(inv, boardId, b.sourceId, { postings: b.postings, complete: false }, nowIso);
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += s[k];
    boards.push({ boardId, ok: true, complete: false, received: b.received, durationMs: 0 });
    inv.boards[boardId] = { boardId, sourceId: b.sourceId, lastAttemptAt: nowIso, lastOkAt: nowIso, lastError: null, consecutiveFailures: 0, lastReceived: b.received };
    log(`${boardId}: +${s.created} nuevos, ~${s.updated} actualizados, =${s.unchanged} sin cambios, ${s.closed} cerrados.`);
  }
  if (byBoard.size) {
    inv.opportunities = buildOpportunities(inv.postings);
    inv.generatedAt = nowIso;
    recordRun(inv, { startedAt: nowIso, finishedAt: new Date().toISOString(), mode: "incremental", boards, ...totals, errors: result.stopped ? 1 : 0 });
    await writeJson(INV, forStorage(inv));
  }

  ledger.entries = [...ledger.entries, ...result.ledger].slice(-1000);
  await writeJson(LEDGER, ledger, true);

  if (result.employers.length) {
    const disc = await readJson<{ updatedAt: string | null; employers: (Employer & { seen: number; lastSeenAt: string })[] }>(DISCOVERIES, { updatedAt: null, employers: [] });
    for (const e of result.employers) {
      const found = disc.employers.find((x) => x.company === e.company && x.host === e.host);
      if (found) Object.assign(found, { seen: found.seen + 1, lastSeenAt: nowIso });
      else disc.employers.push({ ...e, seen: 1, lastSeenAt: nowIso });
    }
    disc.updatedAt = nowIso;
    disc.employers.sort((a, b) => Number(!!b.supported) - Number(!!a.supported) || b.seen - a.seen || a.company.localeCompare(b.company));
    await writeJson(DISCOVERIES, disc, true);
  }

  const open = opportunitiesOf(inv).filter((o) => o.status === "abierta");
  const rejected: Record<string, number> = {};
  for (const b of result.batches) for (const [k, v] of Object.entries(b.rejected)) rejected[k] = (rejected[k] ?? 0) + v;
  summary.push(
    `### Importación ${provider}`,
    `- Filas recibidas: ${result.batches.reduce((a, b) => a + b.received, 0)} · aceptadas: ${result.batches.reduce((a, b) => a + b.postings.length, 0)} · rechazos: ${JSON.stringify(rejected)}`,
    `- Inventario: +${totals.created} nuevos, ~${totals.updated} actualizados, =${totals.unchanged} repetidos · oportunidades abiertas: ${open.length} (elegibles ${open.filter((o) => o.eligibility.status === "elegible").length})`,
    `- Consumo: ${result.ledger.map((l) => `${l.call} ${l.consumed ?? "?"}`).join(" · ")}`,
    result.stopped ? `- Se frenó: ${result.stopped}` : "- Terminó el plan completo.",
  );
  log(summary.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, redact(summary.join("\n")) + "\n", { flag: "a" });
}

main().catch((err) => {
  console.error(redact(String((err as Error)?.message ?? err)));
  process.exitCode = 1;
});
