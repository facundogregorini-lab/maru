/**
 * Busca bolsas públicas (Greenhouse, Lever, Ashby) de las empresas que aparecen en los avisos comprados
 * y suma al directorio las que tienen avisos de calidad para la Argentina (src/lib/match/discover.ts).
 *
 *   npx --yes tsx@4 scripts/match-discover.ts --top=150 --min-eligible=3          # sólo informa
 *   npx --yes tsx@4 scripts/match-discover.ts --top=150 --min-eligible=3 --apply=1 # además las agrega
 *
 * Sólo GET a APIs públicas, sin claves. Lo corre a mano el workflow match-discover.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FETCHERS } from "../src/lib/match/connectors";
import { boardIdFor, type CompanyEntry, type Directory } from "../src/lib/match/directory";
import { discoveryCandidates, nameMatches, slugGuesses } from "../src/lib/match/discover";
import { importRejection } from "../src/lib/match/import-filter";
import { analyzeStandalone, emptyInventory } from "../src/lib/match/inventory";
import { readInventoryFile } from "../src/lib/match/inventory-file";

const DATA = path.join(process.cwd(), "data", "match");
const arg = (name: string, fallback: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "maru-match-discover" }, signal: AbortSignal.timeout(15_000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    await sleep(250);
  }
}

type Found = { company: string; sourceId: "greenhouse" | "lever" | "ashby"; slug: string; received: number; good: number; evidence: string };

/** Primera bolsa que exista para la empresa, o null. Greenhouse informa el nombre: se verifica. */
async function findBoard(company: string): Promise<Omit<Found, "received" | "good"> | null> {
  const { full, short } = slugGuesses(company);
  for (const slug of full) {
    const gh = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}`)) as { name?: string } | null;
    if (gh?.name && nameMatches(gh.name, company)) return { company, sourceId: "greenhouse", slug, evidence: `https://job-boards.greenhouse.io/${slug}` };
    const lever = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`);
    if (Array.isArray(lever) && lever.length) return { company, sourceId: "lever", slug, evidence: `https://jobs.lever.co/${slug}` };
    const ashby = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)) as { jobs?: unknown[] } | null;
    if (ashby?.jobs?.length) return { company, sourceId: "ashby", slug, evidence: `https://jobs.ashbyhq.com/${slug}` };
  }
  if (short) {
    const gh = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${short}`)) as { name?: string } | null;
    if (gh?.name && nameMatches(gh.name, company)) return { company, sourceId: "greenhouse", slug: short, evidence: `https://job-boards.greenhouse.io/${short}` };
  }
  return null;
}

async function main() {
  const top = Number(arg("top", "150"));
  const minEligible = Number(arg("min-eligible", "3"));
  const apply = arg("apply", "0") === "1";
  const now = new Date().toISOString();
  const file = path.join(DATA, "companies.json");
  const dir = JSON.parse(await readFile(file, "utf8")) as Directory;
  const inv = (await readInventoryFile(path.join(DATA, "inventory.json"))) ?? emptyInventory("real");
  const known = new Set(dir.companies.filter((c) => c.sourceId && c.slug).map((c) => boardIdFor(c.sourceId!, c.slug)));
  const candidates = discoveryCandidates(inv.postings, dir).slice(0, top);
  console.log(`Empresas a revisar: ${candidates.length}.`);
  const accepted: Found[] = [];
  const weak: Found[] = [];
  for (const c of candidates) {
    const board = await findBoard(c.company);
    if (!board || known.has(boardIdFor(board.sourceId, board.slug))) continue;
    try {
      const res = await FETCHERS[board.sourceId]({ sourceId: board.sourceId, boardId: boardIdFor(board.sourceId, board.slug), slug: board.slug, company: c.company }, { retries: 1 });
      // Calidad: avisos que se pueden pedir desde la Argentina y de las áreas que importamos.
      const good = res.postings.map((p) => analyzeStandalone(p, now)).filter((p) => p.eligibility.status === "elegible" && !importRejection(p.title, p.extracted.family.value)).length;
      const found = { ...board, received: res.received, good };
      (good >= minEligible ? accepted : weak).push(found);
      known.add(boardIdFor(board.sourceId, board.slug));
      console.log(`${good >= minEligible ? "✓" : "·"} ${c.company} → ${board.evidence}: ${res.received} avisos, ${good} elegibles de las áreas.`);
    } catch (e) {
      console.log(`✗ ${c.company} → ${board.evidence}: ${(e as Error).message}`);
    }
  }
  if (apply && accepted.length) {
    const added: CompanyEntry[] = accepted.map((f) => ({ name: f.company, sourceId: f.sourceId, slug: f.slug, region: "us", sector: "", evidence: f.evidence, addedAt: now.slice(0, 10), status: "candidata" }));
    dir.companies.push(...added);
    await writeFile(file, JSON.stringify(dir, null, 2) + "\n");
  }
  const lines = [
    `### Descubrimiento de empleadores`,
    `- Revisadas: ${candidates.length} · con bolsa pública: ${accepted.length + weak.length} · suman (≥ ${minEligible} elegibles de las áreas): ${accepted.length}${apply ? " (agregadas al directorio)" : " (no se agregaron: --apply=0)"}`,
    `- Elegibles de las áreas que suman: ${accepted.reduce((a, f) => a + f.good, 0)}`,
    "",
    ...accepted.map((f) => `- ✓ ${f.company}: ${f.evidence} (${f.good} de ${f.received})`),
    ...weak.map((f) => `- · ${f.company}: ${f.evidence} (${f.good} de ${f.received}, no alcanza)`),
  ];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", { flag: "a" });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
