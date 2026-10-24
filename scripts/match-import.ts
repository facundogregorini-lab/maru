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
import { APIFY_JOBS, APIFY_KEYWORDS, LINKEDIN_CITIES, apifyJobInput, apifyNextCap, apifyRepeatReason, apifySourceOfActor, knownLinkedinIds, LINKEDIN_ACTORS, LINKEDIN_ALT_FIELDS, normalizeApifyJobs, type ApifyJobSource, type LinkedinActor } from "../src/lib/match/apify";
import { filterImported } from "../src/lib/match/import-filter";
import { readInventoryFile, writeInventoryFile } from "../src/lib/match/inventory-file";
import { applyBoard, buildOpportunities, emptyInventory, forStorage, opportunitiesOf, recordRun } from "../src/lib/match/inventory";
import { fantasticQuota, request, serpAccount } from "../src/lib/match/provider-pilot";
import { FANTASTIC_COHORTS, MONTHLY_QUERY_PREFIXES, runFantastic, runSerp, SERP_QUERIES, type Employer, type ImportBatch, type ImportResult, type LedgerEntry } from "../src/lib/match/providers";
import type { BoardSyncResult, Inventory } from "../src/lib/match/types";

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

/** Últimas líneas del log de una corrida (para entender por qué falló), sin claves ni datos de contacto. */
async function apifyLogTail(runId: string, token: string, chars = 1200): Promise<string> {
  try {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/log`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return `(sin log: HTTP ${res.status})`;
    const text = (await res.text()).slice(-chars);
    return redact(text).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s-]{7,}\d/g, "[número]");
  } catch {
    return "(sin log)";
  }
}

/** Gasto real del mes según Apify (incluye todo lo que corrió la cuenta este mes). */
async function apifyMonthlyUsage(token: string): Promise<number> {
  const d = ((await apifyFetch("https://api.apify.com/v2/users/me/limits", token)).data ?? {}) as Record<string, Record<string, unknown>>;
  const usage = d.current?.monthlyUsageUsd;
  if (typeof usage !== "number" || !Number.isFinite(usage)) throw new Error("Apify no informó el gasto del mes: no se corre nada.");
  return usage;
}

/**
 * `history`: el ledger anterior, para no repetir búsquedas recientes o agotadas (apifyRepeatReason).
 * `skipJobIds`: avisos de LinkedIn que ya tenemos; valig no los devuelve y no se pagan. Se suman los de cada búsqueda.
 */
type ApifyOptions = { remote: boolean; history: LedgerEntry[]; skipJobIds: Set<string>; parallel: number };

async function runApify(token: string, sources: ApifyJobSource[], rows: number, budgetUsd: number, spentBefore: number, keywordsPerSource: number, nowIso: string, custom: string[] = [], useAccount = false, linkedinActor: LinkedinActor = "curious", window: "week" | "month" = "week", onRun?: (partial: ImportResult) => Promise<void>, location = "Argentina", opts: ApifyOptions = { remote: false, history: [], skipJobIds: new Set(), parallel: 1 }): Promise<ImportResult> {
  const out: ImportResult = { batches: [], ledger: [], employers: [], stopped: null };
  // Con --budget-source=account el punto de partida es el gasto real del mes (más exacto que el ledger viejo,
  // que estimaba de más); lo que se corre en esta ejecución se suma con el uso que informa Apify por corrida.
  let spent = useAccount ? await apifyMonthlyUsage(token) : spentBefore;
  if (useAccount) log(`Gasto real de Apify este mes: US$${spent.toFixed(3)} (tope US$${budgetUsd}).`);
  for (const source of sources) {
    const config = APIFY_JOBS[source];
    // LinkedIn puede ir por un Actor alternativo más barato (mismo aviso, mismo id).
    const alt = source === "linkedin" && linkedinActor !== "curious";
    const actorName = source === "linkedin" ? LINKEDIN_ACTORS[linkedinActor].actor : config.actor;
    const wanted: readonly string[] = alt ? LINKEDIN_ALT_FIELDS : config.fields;
    const pending = [...new Set((custom.length ? custom : APIFY_KEYWORDS[source]).slice(0, keywordsPerSource))].filter((keyword) => {
      const repeat = apifyRepeatReason(opts.history, actorName, keyword, location, opts.remote, nowIso);
      if (repeat) log(`↷ ${source} "${keyword}": no se repite (${repeat}).`);
      return !repeat;
    });
    // De a `parallel` búsquedas a la vez: cada una tarda ~5 min y Apify las corre en paralelo. Antes de lanzar un grupo
    // se reserva el peor caso de cada una, así el grupo entero nunca se pasa del presupuesto.
    for (let i = 0; i < pending.length; i += opts.parallel) {
      const group: { keyword: string; cap: number }[] = [];
      let reserved = 0;
      let budgetHit = false;
      for (const keyword of pending.slice(i, i + opts.parallel)) {
        const cap = apifyNextCap(source, rows, spent + reserved, budgetUsd, linkedinActor);
        if (!cap) {
          budgetHit = true;
          break;
        }
        reserved += cap;
        group.push({ keyword, cap });
      }
      const budgetStop = () => `Presupuesto Apify: gastado ~US$${spent.toFixed(3)} de US$${budgetUsd}; la próxima corrida podría pasarse.`;
      if (!group.length) {
        out.stopped = budgetStop();
        return out;
      }
      const skip = source === "linkedin" && linkedinActor === "valig" ? [...opts.skipJobIds] : [];
      let failures = 0;
      const runs = await Promise.all(
        group.map(async ({ keyword, cap }) => {
          const input = apifyJobInput(source, keyword, rows, 500, linkedinActor, window, location, { remote: opts.remote, skipJobIds: skip });
          const params = { actor: actorName, keyword, rows: String(rows), maxTotalChargeUsd: String(cap), location, ...(opts.remote ? { remote: "1" } : {}), ...(skip.length ? { skipJobIds: String(skip.length) } : {}) };
          let run: Record<string, unknown> = {};
          try {
            const actor = actorName.replace("/", "~");
            // ~5 min cada 100 filas con valig: el tiempo máximo crece con las filas (10 min como mínimo).
            const timeout = Math.max(600, rows * 6);
            const started = await apifyFetch(`https://api.apify.com/v2/acts/${actor}/runs?maxItems=${rows}&maxTotalChargeUsd=${cap}&timeout=${timeout}&waitForFinish=60`, token, { method: "POST", body: JSON.stringify(input) });
            run = started.data ?? {};
            for (let n = 0; n < timeout / 60 + 2 && !["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(String(run.status)); n++) {
              run = (await apifyFetch(`https://api.apify.com/v2/actor-runs/${run.id}?waitForFinish=60`, token)).data ?? {};
            }
            return { keyword, cap, params, run, error: null as Error | null };
          } catch (e) {
            // Si la corrida llegó a empezar, queda su id en el ledger para buscarla en Apify.
            return { keyword, cap, params, run, error: e as Error };
          }
        }),
      );
      for (const { keyword, cap, params, run, error } of runs) {
        if (error) {
          // Un corte de red no frena la tanda: se cuenta el tope (puede haberse cobrado) y sigue la próxima.
          spent += cap;
          failures++;
          out.ledger.push({ at: nowIso, provider: "apify", call: "run", params: { ...params, runId: String(run.id ?? ""), datasetId: String(run.defaultDatasetId ?? "") }, rows: 0, consumed: cap, quota: {}, error: redact(error.message) });
          log(`✗ ${source} "${keyword}": ${redact(error.message)}`);
          continue;
        }
        const usage = typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : 0;
        // Si se cortó por tiempo, las filas que alcanzó a guardar ya se pagaron: se importan igual.
        if (run.status !== "SUCCEEDED" && !(run.status === "TIMED-OUT" && run.defaultDatasetId)) {
          // Lo que haya costado igual cuenta, aunque no importemos nada.
          spent += Math.max(usage, cap);
          out.ledger.push({ at: nowIso, provider: "apify", call: "run", params: { ...params, runId: String(run.id ?? "") }, rows: 0, consumed: Math.max(usage, cap), quota: { status: String(run.status ?? "desconocido") }, error: "Ejecución incompleta: no se importa." });
          log(`✗ ${source} "${keyword}": ${run.status}.`);
          if (run.id) log(`  log de Apify: ${(await apifyLogTail(String(run.id), token)).replace(/\s*\n\s*/g, " | ")}`);
          continue;
        }
        try {
          // La API de datasets sólo filtra campos de primer nivel: "companyDetails.name" se pide como "companyDetails".
          const fields = [...new Set(wanted.map((f) => f.split(".")[0]))].join(",");
          const items = (await apifyFetch(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=${rows}&fields=${encodeURIComponent(fields)}`, token)) as unknown as unknown[];
          const list = Array.isArray(items) ? items.slice(0, rows) : [];
          // usageTotalUsd ya incluye las filas cobradas (coincide con el gasto de la cuenta: prueba del 22/10).
          // Si Apify no lo informa, se cuenta el tope de la corrida.
          const cost = Math.round((usage > 0 ? usage : cap) * 10000) / 10000;
          spent += cost;
          const normalized = normalizeApifyJobs(source, list, nowIso);
          const entry: LedgerEntry = { at: nowIso, provider: "apify", call: "run", params: { ...params, runId: String(run.id), datasetId: String(run.defaultDatasetId) }, rows: list.length, consumed: cost, quota: { usageTotalUsd: usage, spentUsd: Math.round(spent * 1000) / 1000, budgetUsd } };
          out.batches.push({ sourceId: `apify-${source}`, boardId: `apify:${source}:ar`, postings: normalized.postings, received: list.length, rejected: normalized.rejected, query: keyword, entry });
          out.ledger.push(entry);
          // También los que se rechazaron (otro país, fuera de área): las búsquedas siguientes de esta corrida no los vuelven a cobrar.
          if (source === "linkedin") for (const id of knownLinkedinIds(list.map((r) => ({ sourceId: "", externalId: "", sourceUrl: String(Object(r).link ?? Object(r).url ?? Object(r).jobUrl ?? ""), applyUrl: "" })))) opts.skipJobIds.add(id);
          if (source === "linkedin") for (const p of normalized.postings) opts.skipJobIds.add(p.externalId);
          // Lo pagado se guarda en disco enseguida: si el job se corta después, no se pierde. Ahí se anota entry.created.
          await onRun?.(out);
          log(`✓ ${source} "${keyword}": ${list.length} filas, ${normalized.accepted} aceptadas, ${entry.created ?? "?"} nuevas, US$${cost.toFixed(3)} (acumulado ~US$${spent.toFixed(3)}).`);
          // Diagnóstico sin datos del aviso: si nada pasa, sólo los nombres de campo que llegaron.
          if (list.length && !normalized.accepted) log(`  campos recibidos: ${Object.keys(Object(list[0])).sort().join(", ")} · rechazos ${JSON.stringify(normalized.rejected)}`);
        } catch (e) {
          // La corrida ya se pagó: queda en el ledger con su dataset para releerla con --mode=refetch.
          spent += Math.max(usage, cap);
          out.ledger.push({ at: nowIso, provider: "apify", call: "run", params: { ...params, runId: String(run.id), datasetId: String(run.defaultDatasetId) }, rows: 0, consumed: Math.max(usage, cap), quota: {}, error: redact((e as Error).message) });
          out.stopped = `${source} "${keyword}": ${redact((e as Error).message)}`;
        }
      }
      // Si falló todo el grupo, algo anda mal con Apify o la red: se frena.
      if (!out.stopped && failures === runs.length) out.stopped = `Fallaron las ${runs.length} búsquedas del grupo; se frena la corrida.`;
      if (!out.stopped && budgetHit) out.stopped = budgetStop();
      if (out.stopped) return out;
    }
  }
  return out;
}

/**
 * Vuelve a leer los datasets de corridas ya pagadas (el ledger guarda su datasetId) y las importa otra vez con
 * la normalización actual. Leer un dataset no cobra filas: sirve para corregir avisos ya comprados, como las
 * descripciones sin saltos de línea de la compra del 19/10. Cada corrida se aplica con su propia hora, en orden,
 * para no mover la última vez que se vio cada aviso.
 *
 * Con `orphans`, también las corridas de la cuenta de Apify que no llegaron al ledger (un job cancelado a mitad
 * de camino, 22/10): se anotan en el ledger con su costo real. Bumeran en modo incremental no las vuelve a mandar.
 */
async function refetchApify(token: string, entries: LedgerEntry[], since: string, onRun: (partial: ImportResult, at: string) => Promise<void>, orphans = false): Promise<ImportResult> {
  if (!/^\d{4}-\d{2}-\d{2}/.test(since)) throw new Error("Indicá --since=AAAA-MM-DD (corridas desde esa fecha).");
  const out: ImportResult = { batches: [], ledger: [], employers: [], stopped: null };
  type Pending = { at: string; actor: string; keyword: string; datasetId: string; entry?: LedgerEntry };
  const runs: Pending[] = entries
    .filter((e) => e.provider === "apify" && e.call === "run" && e.at >= since && e.params.datasetId && apifySourceOfActor(e.params.actor ?? ""))
    .map((e) => ({ at: e.at, actor: e.params.actor, keyword: e.params.keyword ?? "", datasetId: e.params.datasetId }));
  if (orphans) {
    const known = new Set(entries.flatMap((e) => [e.params.runId, e.params.datasetId]).filter(Boolean));
    const actors = [...new Set([...Object.values(APIFY_JOBS), ...Object.values(LINKEDIN_ACTORS)].map((a) => a.actor))];
    for (const actor of actors) {
      const list = ((await apifyFetch(`https://api.apify.com/v2/acts/${actor.replace("/", "~")}/runs?desc=1&limit=200`, token)).data ?? {}) as { items?: Record<string, unknown>[] };
      for (const r of list.items ?? []) {
        const at = String(r.finishedAt ?? r.startedAt ?? "");
        if (at < since || known.has(String(r.id)) || known.has(String(r.defaultDatasetId))) continue;
        if (r.status !== "SUCCEEDED" && r.status !== "TIMED-OUT") continue;
        const run = ((await apifyFetch(`https://api.apify.com/v2/actor-runs/${r.id}`, token)).data ?? {}) as Record<string, unknown>;
        const input = (await apifyFetch(`https://api.apify.com/v2/key-value-stores/${run.defaultKeyValueStoreId}/records/INPUT`, token).catch(() => ({}))) as Record<string, unknown>;
        const raw = input.query ?? input.keyword ?? input.keywords;
        const keyword = String(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "");
        const usage = typeof run.usageTotalUsd === "number" ? run.usageTotalUsd : 0;
        const entry: LedgerEntry = { at, provider: "apify", call: "run", params: { actor, keyword, location: "Argentina", runId: String(r.id), datasetId: String(run.defaultDatasetId), recovered: "1" }, rows: 0, consumed: Math.round(usage * 10000) / 10000, quota: { usageTotalUsd: usage } };
        out.ledger.push(entry);
        runs.push({ at, actor, keyword, datasetId: String(run.defaultDatasetId), entry });
      }
    }
  }
  runs.sort((a, b) => a.at.localeCompare(b.at));
  log(`Corridas a releer desde ${since}: ${runs.length}${orphans ? ` (${out.ledger.length} fuera del ledger)` : ""}.`);
  for (const r of runs) {
    const { source, alt } = apifySourceOfActor(r.actor)!;
    const wanted: readonly string[] = alt ? LINKEDIN_ALT_FIELDS : APIFY_JOBS[source].fields;
    const fields = [...new Set(wanted.map((f) => f.split(".")[0]))].join(",");
    const items = (await apifyFetch(`https://api.apify.com/v2/datasets/${r.datasetId}/items?clean=true&format=json&fields=${encodeURIComponent(fields)}`, token)) as unknown as unknown[];
    const list = Array.isArray(items) ? items : [];
    if (r.entry) r.entry.rows = list.length;
    const normalized = normalizeApifyJobs(source, list, r.at);
    out.batches.push({ sourceId: `apify-${source}`, boardId: `apify:${source}:ar`, postings: normalized.postings, received: list.length, rejected: normalized.rejected, query: r.keyword, ...(r.entry ? { entry: r.entry } : {}) });
    log(`↻ ${source} "${r.keyword}" (${r.at.slice(0, 16)}): ${list.length} filas, ${normalized.accepted} aceptadas.`);
    await onRun(out, r.at);
  }
  return out;
}

/* ---------- guardado: después de cada corrida paga y al final ---------- */

type Progress = { saved: Set<ImportBatch>; totals: { created: number; updated: number; unchanged: number; closed: number }; boards: Map<string, BoardSyncResult> };
const newProgress = (): Progress => ({ saved: new Set(), totals: { created: 0, updated: 0, unchanged: 0, closed: 0 }, boards: new Map() });

/**
 * Aplica al inventario en disco los lotes que todavía no se guardaron y reescribe el ledger completo.
 * Apify lo llama después de cada corrida: si el job se corta, lo ya pagado quedó en disco y el paso
 * "Guardar inventario y consumo" del workflow (always) lo commitea igual.
 */
async function persist(result: ImportResult, ledgerBase: LedgerEntry[], nowIso: string, p: Progress, final = false): Promise<Inventory> {
  const pending = result.batches.filter((b) => !p.saved.has(b));
  // Sólo áreas profesionales (import-filter.ts): lo demás se cuenta como rechazo y no entra.
  for (const b of pending) {
    const { kept, rejected } = filterImported(b.postings);
    b.postings = kept;
    for (const [k, v] of Object.entries(rejected)) b.rejected[k] = (b.rejected[k] ?? 0) + v;
    p.saved.add(b);
  }
  const inv = (await readInventoryFile(INV)) ?? emptyInventory("real");
  if (inv.kind !== "real") throw new Error("inventory.json no es un inventario real.");
  // Lote por lote (una búsqueda cada uno): así cada línea del ledger sabe cuántos avisos nuevos trajo.
  for (const b of pending) {
    const s = applyBoard(inv, b.boardId, b.sourceId, { postings: b.postings, complete: false }, nowIso);
    if (b.entry) b.entry.created = s.created;
    for (const k of Object.keys(p.totals) as (keyof Progress["totals"])[]) p.totals[k] += s[k];
    const received = (p.boards.get(b.boardId)?.received ?? 0) + b.received;
    p.boards.set(b.boardId, { boardId: b.boardId, ok: true, complete: false, received, durationMs: 0 });
    inv.boards[b.boardId] = { boardId: b.boardId, sourceId: b.sourceId, lastAttemptAt: nowIso, lastOkAt: nowIso, lastError: null, consecutiveFailures: 0, lastReceived: received };
    log(`${b.boardId} "${b.query}": +${s.created} nuevos, ~${s.updated} actualizados, =${s.unchanged} sin cambios, ${s.closed} cerrados.`);
  }
  if (pending.length || (final && p.boards.size)) {
    inv.opportunities = buildOpportunities(inv.postings);
    inv.generatedAt = nowIso;
    if (final) recordRun(inv, { startedAt: nowIso, finishedAt: new Date().toISOString(), mode: "incremental", boards: [...p.boards.values()], ...p.totals, errors: result.stopped ? 1 : 0 });
    await writeInventoryFile(INV, forStorage(inv));
  }
  await writeJson(LEDGER, { entries: [...ledgerBase, ...result.ledger].slice(-1000) }, true);
  return inv;
}

/* ---------- main ---------- */

async function main() {
  const provider = arg("provider");
  const mode = arg("mode") ?? "plan";
  if (!["fantastic", "serpapi", "apify"].includes(provider ?? "")) throw new Error("Elegí --provider=fantastic, serpapi o apify.");
  if (!["plan", "status", "run", "refetch"].includes(mode)) throw new Error("--mode debe ser plan, status, run o refetch.");
  if (mode === "refetch" && provider !== "apify") throw new Error("--mode=refetch sólo existe para Apify.");
  const nowIso = new Date().toISOString();
  const ledger = await readJson<{ entries: LedgerEntry[] }>(LEDGER, { entries: [] });

  const fantasticPlan = { cohorts: csv("cohorts", FANTASTIC_COHORTS.map((c) => c.id)), feeds: csv("feeds", ["ats", "jb"]).map((f) => (f === "jb" ? "fantastic_jb" : "fantastic_ats")) as ("fantastic_ats" | "fantastic_jb")[], limit: num("limit", 50), maxJobs: num("max-jobs", 300), timeFrame: (arg("time-frame") ?? "7d") as "24h" | "7d" | "1m", offset: num("offset", 0) };
  const queryArg = csv("queries", SERP_QUERIES.map((q) => q.id));
  // "mensual" = la tanda automática de cada mes (marketing y finanzas).
  const queryIds = queryArg.flatMap((id) => (id === "mensual" ? SERP_QUERIES.filter((q) => MONTHLY_QUERY_PREFIXES.some((p) => q.id.startsWith(p))).map((q) => q.id) : [id]));
  const serpPlan = { queries: SERP_QUERIES.filter((q) => queryIds.includes(q.id)), maxSearches: num("max-searches", 12), reserve: num("reserve", 20) };
  const apifySources = csv("sources", ["linkedin"]).filter((s): s is ApifyJobSource => Object.hasOwn(APIFY_JOBS, s));
  const apifyRows = Math.min(500, Math.max(1, num("rows", 100)));
  const linkedinActor = (arg("actor") ?? "curious") as LinkedinActor;
  if (!Object.hasOwn(LINKEDIN_ACTORS, linkedinActor)) throw new Error("--actor debe ser curious, valig o cheap.");
  const apifyBudget = num("budget-usd", 0);
  const apifySpent = ledger.entries.filter((e) => e.provider === "apify").reduce((a, e) => a + (e.consumed ?? 0), 0);

  if (mode === "plan") {
    const plan = provider === "fantastic" ? fantasticPlan : provider === "serpapi" ? serpPlan : { sources: apifySources, rows: apifyRows, linkedinActor: LINKEDIN_ACTORS[linkedinActor].actor, keywords: APIFY_KEYWORDS, budgetUsd: apifyBudget, spentUsd: apifySpent };
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

  const progress = newProgress();
  let result: ImportResult;
  if (mode === "refetch") result = await refetchApify(key("APIFY_TOKEN"), ledger.entries, arg("since") ?? "", (partial, at) => persist(partial, ledger.entries, at, progress).then(() => undefined), arg("orphans") === "1");
  else if (provider === "fantastic") result = await runFantastic(key("FANTASTIC_JOBS"), fantasticPlan, log, nowIso);
  else if (provider === "serpapi") result = await runSerp(key("SERP_API"), serpPlan, log, nowIso);
  else {
    // Tope aprobado por el dueño: US$5 (16/10) más la compra única de hasta US$29 (19/10). Con --budget-source=account
    // se compara contra el gasto real del mes en Apify, así que el número a pasar es gasto actual + lo que se quiere gastar.
    if (!(apifyBudget > 0 && apifyBudget <= 35)) throw new Error("Indicá --budget-usd entre 0 y 35 (presupuesto aprobado por el dueño).");
    const window = arg("date-posted") ?? "week";
    if (window !== "week" && window !== "month") throw new Error("--date-posted debe ser week o month.");
    // --location=latam busca puestos de LinkedIn para Latinoamérica (casi siempre remotos), sólo con los Actors alternativos.
    // --location=cordoba (y las demás de LINKEDIN_CITIES): la misma búsqueda por ciudad, sólo LinkedIn con valig o cheap.
    const where = arg("location") ?? "argentina";
    const city = LINKEDIN_CITIES[where];
    if (where !== "argentina" && where !== "latam" && !city) throw new Error(`--location debe ser argentina, latam o una de: ${Object.keys(LINKEDIN_CITIES).join(", ")}.`);
    if ((where === "latam" || city) && linkedinActor === "curious") throw new Error("--location=latam o una ciudad sólo con --actor=valig o cheap.");
    // --remote=1: filtro «Remoto» de LinkedIn (sólo valig). Con valig, además, nunca se piden avisos que ya tenemos.
    const remote = arg("remote") === "1";
    if (remote && linkedinActor !== "valig") throw new Error("--remote=1 sólo con --actor=valig.");
    // Se valida antes de gastar: un error al armar la búsqueda dentro de la corrida contaría su tope como gastado.
    if ((remote || where !== "argentina") && apifySources.some((s) => s !== "linkedin")) throw new Error("--remote=1 y --location distinta de argentina sólo con --sources=linkedin.");
    const skipJobIds = new Set(linkedinActor === "valig" ? knownLinkedinIds(((await readInventoryFile(INV)) ?? emptyInventory("real")).postings) : []);
    if (skipJobIds.size) log(`Avisos de LinkedIn que ya tenemos (no se piden): ${skipJobIds.size}.`);
    // --keywords=administrativo_tucuman,vendedor_mendoza: "_" es espacio (el workflow no admite espacios en args).
    const custom = csv("keywords", []).map((k) => k.replace(/_/g, " "));
    result = await runApify(key("APIFY_TOKEN"), apifySources, apifyRows, apifyBudget, apifySpent, num("keywords-per-source", 10), nowIso, custom, arg("budget-source") === "account", linkedinActor, window, (partial) => persist(partial, ledger.entries, nowIso, progress).then(() => undefined), where === "latam" ? "Latin America" : (city ?? "Argentina"), { remote, history: ledger.entries, skipJobIds, parallel: Math.min(5, Math.max(1, Math.floor(num("parallel", 1)))) });
  }

  const inv = await persist(result, ledger.entries, nowIso, progress, true);
  const totals = progress.totals;

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
