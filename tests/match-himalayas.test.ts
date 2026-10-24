import { describe, expect, it } from "vitest";
import { fetchHimalayas, normalizeHimalayas, type Board } from "@/lib/match/connectors";
import { boardsFrom } from "@/lib/match/directory";
import { analyzeStandalone } from "@/lib/match/inventory";
import { markRemoteGlobal } from "@/lib/match/sync";

const NOW = "2026-10-23T12:00:00.000Z";
const desc = `<p>We build payments infrastructure.</p><h3>Requirements</h3><ul><li>4+ years of experience with Python and SQL</li><li>Experience with AWS</li></ul>${"<p>Details about the team and the product roadmap.</p>".repeat(6)}`;
const job = (over: Record<string, unknown> = {}) => ({
  title: "Data Engineer",
  companyName: "Acme",
  companyLogo: "https://cdn-images.himalayas.app/acme.png",
  employmentType: "Full Time",
  minSalary: 60000,
  maxSalary: 80000,
  salaryPeriod: "annual",
  seniority: ["Mid-level", "Senior"],
  currency: "USD",
  locationRestrictions: ["Argentina", "Brazil"],
  parentCategories: ["Data Science"],
  description: desc,
  pubDate: 1792756773,
  expiryDate: 1797940772,
  applicationLink: "https://himalayas.app/companies/acme/jobs/senior-data-engineer?utm_source=api",
  guid: "https://himalayas.app/companies/acme/jobs/senior-data-engineer",
  ...over,
});
const board: Board = { sourceId: "himalayas", boardId: "himalayas" };

describe("Himalayas", () => {
  it("normaliza con su enlace de postulación, crédito, vencimiento y nivel", () => {
    const p = normalizeHimalayas(job() as never, board);
    expect(p).toMatchObject({ sourceId: "himalayas", applyUrl: job().applicationLink, linkRequired: true, attribution: "Publicado en Himalayas", countries: ["AR", "BR"], companyLogo: job().companyLogo, seniorityHint: "Mid level / Senior" });
    expect(p.expiresAt).toBe(new Date(1797940772000).toISOString());
    expect(p.salary?.value).toMatchObject({ min: 60000, max: 80000, currency: "USD", period: "anio" });
    const a = analyzeStandalone(p, NOW);
    expect(a.eligibility.status).toBe("elegible");
    expect(a.extracted.seniority?.value).toBe("semi_senior");
    expect(a.extracted.skillsRequired).toEqual(expect.arrayContaining(["python", "sql"]));
  });

  it("sin países es de cualquier lugar; sin moneda no inventa salario", () => {
    const p = normalizeHimalayas(job({ locationRestrictions: [], currency: null }) as never, board);
    expect(p.remoteGlobal).toBe(true);
    expect(p.salary).toBeNull();
    expect(analyzeStandalone(p, NOW).eligibility.status).toBe("elegible");
  });

  it("pide la búsqueda para Argentina por página, con pausa, y nunca da el listado por completo", async () => {
    const calls: string[] = [];
    const pauses: number[] = [];
    const page = (n: number) => Array.from({ length: n }, (_, i) => job({ guid: `https://himalayas.app/companies/acme/jobs/j${calls.length}-${i}` }));
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ totalCount: 25, jobs: page(calls.length === 1 ? 20 : 5) }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const res = await fetchHimalayas(board, { fetchImpl, retries: 0, sleep: async (ms) => void pauses.push(ms) });
    expect(calls).toEqual(["https://himalayas.app/jobs/api/search?country=AR&sort=recent&page=1", "https://himalayas.app/jobs/api/search?country=AR&sort=recent&page=2"]);
    expect(pauses).toEqual([1100]);
    expect(res).toMatchObject({ complete: false, received: 25 });
    expect(res.postings).toHaveLength(25);
  });

  it("está entre los portales que sincronizamos", () => {
    expect(boardsFrom({ reviewedAt: "", companies: [] }).map((b) => b.boardId)).toContain("himalayas");
  });
});

describe("empresas que contratan desde cualquier país (Tether)", () => {
  it("el directorio marca la bolsa y sus remotos sin región pasan a elegibles", () => {
    const [b] = boardsFrom({ reviewedAt: "", companies: [{ name: "Tether", sourceId: "recruitee", slug: "tether", evidence: "", addedAt: "", status: "candidata", remoteGlobal: true }] }).filter((x) => x.boardId === "recruitee:tether");
    expect(b.remoteGlobal).toBe(true);
    const base = { sourceId: "recruitee" as const, boardId: b.boardId, externalId: "1", title: "Head of Global Events", company: "Tether", sourceUrl: "https://x.test/1", applyUrl: "https://x.test/1", linkRequired: false, descriptionText: "Join our fully remote team.", descriptionComplete: true, locations: ["Remote job"], countries: [], regionText: [], workplace: { value: "remoto" as const, from: "fuente" as const }, remoteFlag: true, employmentType: null, salary: null, publishedAt: null, updatedAt: null, expiresAt: null };
    const usOnly = { ...base, externalId: "2", descriptionText: "Candidates must reside in the United States." };
    const london = { ...base, externalId: "3", countries: ["GB"], workplace: { value: "hibrido" as const, from: "fuente" as const } };
    const postings = [base, usOnly, london];
    markRemoteGlobal(b, postings);
    expect(postings.map((p) => !!(p as { remoteGlobal?: boolean }).remoteGlobal)).toEqual([true, true, false]);
    expect(postings.map((p) => analyzeStandalone(p, NOW).eligibility.status)).toEqual(["elegible", "no_elegible", "no_elegible"]);
  });
});

describe("vigencia de Himalayas", () => {
  it("consulta su API de verificación sólo para los que no volvieron en la última lectura", async () => {
    const { applyBoard, emptyInventory } = await import("@/lib/match/inventory");
    const { checkImportedLiveness, himalayasCheckUrl } = await import("@/lib/match/liveness");
    expect(himalayasCheckUrl("https://himalayas.app/companies/acme/jobs/data-engineer")).toBe("https://himalayas.app/jobs/api/companies/acme/jobs/data-engineer");
    expect(himalayasCheckUrl("https://evil.test/companies/acme/jobs/x")).toBeNull();
    const inv = emptyInventory("fixture");
    const jobs = ["a", "b", "c"].map((id) => normalizeHimalayas(job({ guid: `https://himalayas.app/companies/acme/jobs/${id}` }) as never, board));
    applyBoard(inv, "himalayas", "himalayas", { postings: jobs, complete: false }, "2026-10-20T10:00:00.000Z");
    // "c" volvió hoy en el feed: no se consulta.
    applyBoard(inv, "himalayas", "himalayas", { postings: [jobs[2]], complete: false }, "2026-10-23T10:00:00.000Z");
    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response("{}", { status: String(url).endsWith("/a") ? 410 : 200 });
    }) as typeof fetch;
    const stats = await checkImportedLiveness(inv, "2026-10-23T12:00:00.000Z", { fetchImpl, resolve: async () => ["93.184.216.34"], pauseMs: 0 });
    expect(calls.sort()).toEqual(["https://himalayas.app/jobs/api/companies/acme/jobs/a", "https://himalayas.app/jobs/api/companies/acme/jobs/b"]);
    expect(stats).toMatchObject({ checked: 2, closed: 1, open: 1 });
    expect(inv.postings.find((p) => p.externalId.endsWith("/a"))!.status).toBe("cerrada");
  });
});
