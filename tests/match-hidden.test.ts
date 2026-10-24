import { describe, expect, it } from "vitest";
import { isHiddenOpportunity, TEASER_POSITIONS, withHiddenSection } from "@/lib/match/hidden";
import { rankOpportunities, type RankedItem, type RankOutput } from "@/lib/match/ranking";
import type { StoredPosting } from "@/lib/match/types";
import { EVAL_CASES, EVAL_NOW, evalInventory } from "./match-eval-cases";

const post = (sourceId: string, sourceUrl = "https://boards.greenhouse.io/acme/jobs/1", applyUrl = "") => ({ sourceId, sourceUrl, applyUrl }) as StoredPosting;
const item = (id: string, score: number, hidden = false) => ({ id, score, title: `Puesto ${id}`, company: `Empresa ${id}`, ...(hidden ? { hidden: true } : {}) }) as RankedItem;
const output = (eligible: RankedItem[], pending: RankedItem[] = [], saved: RankedItem[] = []): RankOutput => ({
  eligible,
  pending,
  saved,
  counts: { open: 100, eligible: eligible.length + 10, pending: pending.length, lowMatch: 0, afterHardFilters: 50, shown: eligible.length + pending.length },
});

describe("oportunidades ocultas: qué cuenta como no publicada en LinkedIn", () => {
  it("sólo el ATS de la empresa es oculta", () => {
    expect(isHiddenOpportunity([post("greenhouse")])).toBe(true);
    expect(isHiddenOpportunity([post("lever"), post("fantastic_ats", "https://acme.wd1.myworkdayjobs.com/x")])).toBe(true);
  });

  it("si alguna publicación es de LinkedIn o de un portal, no", () => {
    expect(isHiddenOpportunity([post("greenhouse"), post("apify-linkedin", "https://www.linkedin.com/jobs/view/1234567")])).toBe(false);
    expect(isHiddenOpportunity([post("fantastic_jb", "https://ar.linkedin.com/jobs/view/1234567")])).toBe(false);
    expect(isHiddenOpportunity([post("greenhouse"), post("remotive", "https://remotive.com/x")])).toBe(false);
    expect(isHiddenOpportunity([post("usuario", "maru:usuario:1")])).toBe(false);
    expect(isHiddenOpportunity([])).toBe(false);
  });

  it("un ATS que redirige la postulación a LinkedIn no es oculta", () => {
    expect(isHiddenOpportunity([post("fantastic_ats", "https://acme.com/jobs/1", "https://www.linkedin.com/jobs/view/1234567")])).toBe(false);
  });
});

describe("ocultas según el plan", () => {
  const pool = [item("x", 95, true), item("y", 91, true), item("z", 90, true)];
  const ranked = { ...output([item("a", 92, true), item("b", 88)], [item("c", 70, true)], [item("a", 92, true)]), hiddenPool: pool, counts: { ...output([]).counts, eligible: 12, pending: 1, hidden: 120 } };

  it("con plan pago: todas en la pestaña, sin difuminar, y siguen en las listas", () => {
    const r = withHiddenSection(ranked, true);
    expect(r.hidden).toMatchObject({ total: 120, full: true, teasers: [] });
    expect(r.hidden.items.map((i) => i.id)).toEqual(["x", "y", "z"]);
    expect(r.eligible.map((i) => i.id)).toEqual(["a", "b"]);
    expect("hiddenPool" in r).toBe(false);
  });

  it("sin plan: la pestaña no trae ninguna, sólo el total y el % de dos para difuminar en «Para vos»", () => {
    const r = withHiddenSection(ranked, false);
    expect(r.hidden).toEqual({ items: [], teasers: [{ score: 95 }, { score: 91 }], total: 120, full: false });
    expect(TEASER_POSITIONS).toEqual([1, 3]);
    // Ninguna oculta queda en las listas ni viaja con sus datos.
    expect([...r.eligible, ...r.pending, ...r.saved].map((i) => i.id)).toEqual(["b"]);
    expect(JSON.stringify(r)).not.toMatch(/Empresa [axyzc]/);
    expect(r.counts).toMatchObject({ eligible: 11, pending: 0, shown: 1 });
  });

  it("sin ocultas, nada que difuminar", () => {
    const r = withHiddenSection(output([item("b", 88)]), false);
    expect(r.hidden).toEqual({ items: [], teasers: [], total: 0, full: false });
  });
});

describe("el ranking deja afuera las ocultas para el plan gratis", () => {
  it("las cuenta y arma el pool, pero no las lista", () => {
    const { opportunities, postings } = evalInventory();
    const map = new Map(postings.map((p) => [p.key, p]));
    const leader = EVAL_CASES[0];
    const base = { opportunities, postings: map, profile: leader.profile, prefs: leader.prefs, interactions: { saved: [], discarded: [] }, now: EVAL_NOW };
    const all = rankOpportunities(base);
    const free = rankOpportunities({ ...base, excludeHidden: true });
    const hiddenIds = new Set((all.hiddenPool ?? []).map((i) => i.id));
    expect(hiddenIds.size).toBeGreaterThan(0);
    expect([...free.eligible, ...free.pending].some((i) => hiddenIds.has(i.id))).toBe(false);
    expect(free.counts.hidden).toBe(all.counts.hidden);
    expect(free.counts.eligible + free.counts.pending + (free.counts.hidden ?? 0)).toBe(all.counts.eligible + all.counts.pending);
  });
});
