/**
 * Agrega una empresa al directorio después de validar su bolsa con la API pública.
 *
 *   npm run match:add-company -- https://job-boards.greenhouse.io/clara "Clara" "fintech"
 *
 * Si la API no responde, no se agrega nada.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FETCHERS, parseBoardUrl } from "../src/lib/match/connectors";
import { boardIdFor, type Directory } from "../src/lib/match/directory";
import { classifyEligibility } from "../src/lib/match/eligibility";

async function main() {
  const [url, name, sector = ""] = process.argv.slice(2);
  if (!url) throw new Error("Uso: npm run match:add-company -- <url> [nombre] [sector]");
  const ats = parseBoardUrl(url);
  if (!ats) throw new Error("URL no reconocida (Greenhouse, Lever o Ashby).");
  const file = path.join(process.cwd(), "data", "match", "companies.json");
  const dir = JSON.parse(await readFile(file, "utf8")) as Directory;
  const boardId = boardIdFor(ats.sourceId, ats.slug);
  if (dir.companies.some((c) => c.sourceId && c.slug && boardIdFor(c.sourceId, c.slug) === boardId)) {
    console.log(`${boardId} ya está en el directorio.`);
    return;
  }
  const res = await FETCHERS[ats.sourceId]({ sourceId: ats.sourceId, boardId, slug: ats.slug, region: ats.region, company: name }, { retries: 1 });
  const counts = { elegible: 0, por_confirmar: 0, no_elegible: 0 };
  for (const p of res.postings) counts[classifyEligibility(p).status]++;
  dir.companies.push({
    name: name || res.postings[0]?.company || ats.slug,
    sourceId: ats.sourceId,
    slug: ats.slug,
    region: ats.region,
    sector,
    evidence: url,
    addedAt: new Date().toISOString().slice(0, 10),
    status: "candidata",
  });
  await writeFile(file, JSON.stringify(dir, null, 2) + "\n");
  console.log(`Agregada ${boardId}: ${res.received} avisos (elegibles ${counts.elegible}, por confirmar ${counts.por_confirmar}, no elegibles ${counts.no_elegible}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
