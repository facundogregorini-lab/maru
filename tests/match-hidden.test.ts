import { describe, expect, it } from "vitest";
import { isHiddenOpportunity, isLocked, withHiddenSection } from "@/lib/match/hidden";
import type { RankedItem, RankOutput } from "@/lib/match/ranking";
import type { StoredPosting } from "@/lib/match/types";

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

describe("sección «Ocultas» según el plan", () => {
  const ranked = output([item("a", 90, true), item("b", 88), item("c", 85, true), item("d", 80, true)], [item("e", 70, true), item("f", 65, true), item("g", 60, true)], [item("c", 85, true)]);

  it("con plan pago van todas, sin difuminar", () => {
    const r = withHiddenSection(ranked, true);
    expect(r.hidden).toMatchObject({ total: 6, full: true });
    expect(r.hidden.items.some(isLocked)).toBe(false);
    expect(r.eligible).toHaveLength(4);
  });

  it("en el plan gratis, 2 de las 5 primeras llegan sólo con el porcentaje", () => {
    const r = withHiddenSection(ranked, false);
    expect(r.hidden.total).toBe(6);
    expect(r.hidden.full).toBe(false);
    expect(r.hidden.items).toHaveLength(5);
    expect(r.hidden.items.map((e) => (isLocked(e) ? `🔒${e.score}` : e.id))).toEqual(["a", "🔒85", "d", "🔒70", "f"]);
    // Las difuminadas no traen ningún otro dato.
    for (const e of r.hidden.items.filter(isLocked)) expect(Object.keys(e).sort()).toEqual(["locked", "score"]);
  });

  it("las difuminadas salen de todas las listas y de los conteos, para no filtrarse por otro lado", () => {
    const r = withHiddenSection(ranked, false);
    const ids = [...r.eligible, ...r.pending, ...r.saved].map((i) => i.id);
    expect(ids).not.toContain("c");
    expect(ids).not.toContain("e");
    expect(JSON.stringify(r)).not.toContain("Empresa c");
    expect(r.counts).toMatchObject({ eligible: ranked.counts.eligible - 1, pending: ranked.counts.pending - 1, shown: 5 });
  });

  it("sin ocultas, la sección queda vacía", () => {
    const r = withHiddenSection(output([item("b", 88)]), false);
    expect(r.hidden).toEqual({ items: [], total: 0, full: false });
    expect(r.eligible).toHaveLength(1);
  });
});

describe("ocultas de todo el ranking, no sólo de la página", () => {
  it("usa el pool del ranking y su conteo total", () => {
    const pool = [item("x", 95, true), item("y", 91, true), item("z", 90, true)];
    const r = withHiddenSection({ ...output([item("b", 88)]), hiddenPool: pool, counts: { ...output([]).counts, hidden: 120 } }, true);
    expect(r.hidden.total).toBe(120);
    expect(r.hidden.items.map((e) => (isLocked(e) ? "" : e.id))).toEqual(["x", "y", "z"]);
    expect("hiddenPool" in r).toBe(false);
  });
});
