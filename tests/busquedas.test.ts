import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { getJob, searchJobs } from "@/lib/busquedas";
import { landingData } from "@/lib/landing";
import { parseJobQuery } from "@/lib/jobFilters";
import { fetchGreenhouse, fetchRemotive } from "@/lib/match/connectors";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { resetInventoryCache } from "@/lib/match/load";
import { BOARDS, fakeFetch, fixture, noSleep } from "./match-helpers";

const NOW = new Date("2026-10-17T12:00:00Z");
const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });

beforeAll(async () => {
  const inv = emptyInventory("fixture");
  const t = "2026-10-10T12:00:00.000Z";
  applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api": fixture("greenhouse-board.json") })), t);
  applyBoard(inv, "remotive", "remotive", await fetchRemotive(BOARDS.remotive, opts({ "https://remotive.com": fixture("remotive.json") })), t);
  inv.opportunities = buildOpportunities(inv.postings);
  const file = path.join(mkdtempSync(path.join(tmpdir(), "maru-busq-")), "inventory.json");
  writeFileSync(file, JSON.stringify(inv));
  process.env.MATCH_INVENTORY_PATH = file;
  resetInventoryCache();
});

describe("parseJobQuery", () => {
  it("toma los filtros válidos e ignora los desconocidos", () => {
    expect(parseJobQuery({ q: "  Data  ", area: "software", nivel: "inventado", modalidad: "remoto", donde: "todo", pagina: "3" })).toEqual({
      q: "Data",
      area: "software",
      nivel: "",
      modalidad: "remoto",
      donde: "todo",
      pagina: 3,
    });
    expect(parseJobQuery({ area: "toString", pagina: "-4" })).toMatchObject({ area: "", donde: "ar", pagina: 1 });
  });
});

describe("searchJobs", () => {
  it("por defecto muestra sólo lo que se puede tomar desde Argentina, con su link para postularse", async () => {
    const all = await searchJobs(parseJobQuery({ donde: "todo" }), NOW);
    const ar = await searchJobs(parseJobQuery({}), NOW);
    expect(all.total).toBeGreaterThan(0);
    expect(ar.total).toBeLessThanOrEqual(all.total);
    expect(ar.results.every((r) => r.eligible)).toBe(true);
    expect(all.results.every((r) => r.applyUrl.startsWith("http"))).toBe(true);
  });

  it("busca por palabra sin importar mayúsculas ni tildes", async () => {
    const { results } = await searchJobs(parseJobQuery({ donde: "todo" }), NOW);
    const word = results[0].title.split(/\s+/)[0];
    const found = await searchJobs(parseJobQuery({ donde: "todo", q: word.toUpperCase() }), NOW);
    expect(found.results.map((r) => r.id)).toContain(results[0].id);
    expect((await searchJobs(parseJobQuery({ donde: "todo", q: "zzzz-no-existe" }), NOW)).total).toBe(0);
  });

  it("busca también por lugar", async () => {
    const { results } = await searchJobs(parseJobQuery({ donde: "todo" }), NOW);
    const withPlace = results.find((r) => r.where && !/remot/i.test(r.where))!;
    const place = withPlace.where.split(/[,·]/)[0].trim();
    const found = await searchJobs(parseJobQuery({ donde: "todo", q: place }), NOW);
    expect(found.results.map((r) => r.id)).toContain(withPlace.id);
  });

  it("no lista avisos de más de 120 días, pero su página sigue andando", async () => {
    const { results } = await searchJobs(parseJobQuery({ donde: "todo" }), NOW);
    const later = new Date(NOW.getTime() + 130 * 86_400_000);
    expect((await searchJobs(parseJobQuery({ donde: "todo" }), later)).total).toBe(0);
    expect(await getJob(results[0].id)).not.toBeNull();
  });
});


describe("cifras del home", () => {
  it("cuenta sólo los avisos que el buscador puede mostrar y no promociona avisos antiguos", async () => {
    const data = await landingData(NOW);
    const all = await searchJobs(parseJobQuery({ donde: "todo" }), NOW);
    const ar = await searchJobs(parseJobQuery({}), NOW);
    expect(data.total).toBe(all.total);
    expect(data.eligible).toBe(ar.total);
    const later = new Date(NOW.getTime() + 130 * 86_400_000);
    expect(await landingData(later)).toMatchObject({ total: 0, eligible: 0, latest: [] });
  });
});
