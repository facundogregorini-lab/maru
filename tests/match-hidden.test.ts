import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fetchGreenhouse, fetchRemotive } from "@/lib/match/connectors";
import { applyHidden, isHidden } from "@/lib/match/hidden";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { resetInventoryCache } from "@/lib/match/load";
import type { RankedItem, RankOutput, SourceLink } from "@/lib/match/ranking";
import { BOARDS, basePrefs, dataProfile, fakeFetch, fixture, noInteractions, noSleep } from "./match-helpers";

let paid = false;
vi.mock("@/lib/billing/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/http")>();
  return { ...actual, paidFeatures: async () => paid };
});

const { POST } = await import("@/app/api/match/ranking/route");

const ats: SourceLink = { name: "Greenhouse Job Board API", url: "https://job-boards.greenhouse.io/acme/jobs/1", applyUrl: "", required: false, kind: "ats" };
const li: SourceLink = { name: "LinkedIn (vía Apify)", url: "https://ar.linkedin.com/jobs/view/123456789", applyUrl: "", required: true, kind: "portal" };
const item = (id: string, score: number, sources: SourceLink[]) => ({ id, title: `Puesto ${id}`, company: `Empresa ${id}`, score, sources }) as unknown as RankedItem;
const out = (eligible: RankedItem[], pending: RankedItem[] = []): RankOutput => ({
  eligible,
  pending,
  saved: [],
  counts: { open: 99, eligible: eligible.length, pending: pending.length, lowMatch: 0, afterHardFilters: 0, shown: 0, hiddenEligible: eligible.filter(isHidden).length, hiddenPending: pending.filter(isHidden).length },
});

describe("oportunidades ocultas", () => {
  it("son las del ATS de la empresa que no vimos en LinkedIn", () => {
    expect(isHidden(item("a", 80, [ats]))).toBe(true);
    expect(isHidden(item("b", 80, [ats, li]))).toBe(false);
    expect(isHidden(item("c", 80, [li]))).toBe(false);
    expect(isHidden({ ...item("d", 80, [ats]), external: true })).toBe(false);
  });

  it("plan gratis: no manda sus datos y difumina hasta dos con match fuerte en los lugares 2 y 4", () => {
    const r = out([item("v1", 95, [li]), item("h1", 90, [ats]), item("v2", 85, [li]), item("h2", 72, [ats]), item("h3", 60, [ats])], [item("h4", 50, [ats])]);
    const res = applyHidden(r, r, false);
    expect(res.eligible.map((x) => x.id)).toEqual(["v1", "v2"]);
    expect(res.pending).toEqual([]);
    expect(res.hiddenItems).toEqual([]);
    expect(res.hidden).toEqual({ unlocked: false, eligible: 3, pending: 1, teaser: [{ position: 2, score: 90 }, { position: 4, score: 72 }] });
    expect(res.counts.eligible).toBe(2);
    expect(JSON.stringify(res)).not.toMatch(/Empresa h|Puesto h|greenhouse/);
  });

  it("plan pago: las marca y las junta en su propia sección", () => {
    const r = out([item("v1", 95, [li]), item("h1", 90, [ats])]);
    const res = applyHidden(r, r, true);
    expect(res.eligible.map((x) => [x.id, !!x.hidden])).toEqual([["v1", false], ["h1", true]]);
    expect(res.hiddenItems.map((x) => x.id)).toEqual(["h1"]);
    expect(res.hidden).toMatchObject({ unlocked: true, eligible: 1, teaser: [] });
  });

  it("cuenta las ocultas que quedaron fuera de la ventana re-evaluada", () => {
    const before = { ...out([item("h1", 90, [ats])]), counts: { ...out([]).counts, eligible: 10, hiddenEligible: 6 } };
    const after = { ...before, eligible: [item("v1", 92, [li])] };
    expect(applyHidden(after, before, false).hidden.eligible).toBe(5);
  });
});

describe("API de ranking con ocultas", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-17T12:00:00Z") });
    const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });
    const inv = emptyInventory("fixture");
    const t = "2026-10-10T12:00:00.000Z";
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api": fixture("greenhouse-board.json") })), t);
    applyBoard(inv, "remotive", "remotive", await fetchRemotive(BOARDS.remotive, opts({ "https://remotive.com": fixture("remotive.json") })), t);
    inv.opportunities = buildOpportunities(inv.postings);
    inv.generatedAt = t;
    const invPath = path.join(mkdtempSync(path.join(tmpdir(), "maru-hidden-")), "inventory.json");
    writeFileSync(invPath, JSON.stringify(inv));
    process.env.MATCH_INVENTORY_PATH = invPath;
    resetInventoryCache();
  });

  const call = async () =>
    (await POST(new Request("http://localhost/api/match/ranking", { method: "POST", body: JSON.stringify({ profile: dataProfile, prefs: basePrefs, interactions: noInteractions, ia: false }) }))).json();

  it("al plan gratis no le llegan los avisos ocultos; al pago, sí", async () => {
    paid = true;
    const full = await call();
    expect(full.hidden.unlocked).toBe(true);
    expect(full.hiddenItems.length).toBeGreaterThan(0);
    paid = false;
    const free = await call();
    expect(free.hidden.unlocked).toBe(false);
    expect(free.hiddenItems).toEqual([]);
    const ids = [...free.eligible, ...free.pending].map((x: RankedItem) => x.id);
    for (const h of full.hiddenItems as RankedItem[]) expect(ids).not.toContain(h.id);
  });
});
