/** Piloto manual: por defecto sólo muestra la configuración; nunca programa ni publica avisos. */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApifyClient } from "apify-client";
import { APIFY_JOBS, apifyJobInput, normalizeApifyJobs, type ApifyJobSource } from "../src/lib/match/apify";
import { applyBoard, buildOpportunities, emptyInventory } from "../src/lib/match/inventory";
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  const source = arg("source") as ApifyJobSource;
  if (!Object.hasOwn(APIFY_JOBS, source)) throw new Error("Elegí --source=linkedin, indeed o computrabajo.");
  const config = APIFY_JOBS[source];
  const limit = Number(arg("max-items") ?? 50);
  const input = apifyJobInput(source, arg("keyword") ?? "analista", limit);
  const file = arg("file");
  const runId = arg("run-id");
  const runPaid = process.argv.includes("--run");
  const budget = Number(arg("budget-usd"));
  const modes = [!!file, !!runId, runPaid].filter(Boolean).length;
  if (modes > 1) throw new Error("Usá una sola opción: --file, --run-id o --run.");
  if (!modes) { console.log(JSON.stringify({ mode: "dry-run", actor: config.actor, input, instruction: "Usá --file para evaluar un dataset descargado; --run-id para recuperar uno existente; --run --budget-usd=... inicia un consumo pago previamente autorizado." }, null, 2)); return; }
  let rows: unknown[];
  let metadata: unknown = { file };
  if (file) {
    const data = JSON.parse(await readFile(file, "utf8"));
    rows = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(rows)) throw new Error("El archivo debe contener un array o {items: [...] }.");
  } else {
    if (!process.env.APIFY_TOKEN) throw new Error("Falta APIFY_TOKEN en el entorno (no lo pases por argumentos ni lo guardes en Git).");
    if (runPaid && (!Number.isFinite(budget) || budget <= 0 || budget > 0.5)) throw new Error("Indicá --budget-usd entre 0 y 0.50, dentro del monto autorizado.");
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
    const run = runId ? await client.run(runId).get() : await client.actor(config.actor).call(input, { maxTotalChargeUsd: budget, timeout: 180 });
    if (!run || run.status !== "SUCCEEDED") throw new Error(`No se importa una ejecución incompleta: ${run?.id ?? "desconocida"} / ${run?.status ?? "no encontrada"}.`);
    const actor = await client.actor(config.actor).get();
    if (!actor || actor.id !== run.actId) throw new Error("La ejecución no corresponde al Actor elegido.");
    const result = await client.dataset(run.defaultDatasetId).listItems({ limit, clean: true, fields: [...config.fields] });
    rows = result.items;
    metadata = { actor: config.actor, runId: run.id, datasetId: run.defaultDatasetId, status: run.status, usageTotalUsd: run.usageTotalUsd, datasetTotal: result.total };
  }
  const now = new Date().toISOString();
  const result = normalizeApifyJobs(source, rows.slice(0, limit), now);
  const candidate = emptyInventory("real");
  applyBoard(candidate, `apify:${source}:ar`, `apify-${source}`, { postings: result.postings, complete: false }, now);
  candidate.opportunities = buildOpportunities(candidate.postings);
  candidate.generatedAt = now;
  const output = path.resolve(arg("out") ?? `work/apify-${source}-candidate.json`);
  if (output === path.resolve("data/match/inventory.json")) throw new Error("El piloto no reemplaza el inventario público. Elegí otro archivo de salida.");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(`${output}.tmp`, JSON.stringify({ metadata, quality: { received: result.received, accepted: result.accepted, rejected: result.rejected }, inventory: candidate }, null, 2) + "\n");
  await rename(`${output}.tmp`, output);
  console.log(JSON.stringify({ output, received: result.received, accepted: result.accepted, rejected: result.rejected, opportunities: candidate.opportunities.length }));
}
main().catch((error) => { const message = String(error?.message ?? "Falló el piloto."); console.error(process.env.APIFY_TOKEN ? message.replaceAll(process.env.APIFY_TOKEN, "[redacted]") : message); process.exitCode = 1; });
