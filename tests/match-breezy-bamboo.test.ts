import { describe, expect, it } from "vitest";
import { breezyDescription, fetchBamboo, fetchBreezy, normalizeBamboo, normalizeBreezy, type Board } from "@/lib/match/connectors";
import { boardsFrom } from "@/lib/match/directory";
import { applyBoard, emptyInventory } from "@/lib/match/inventory";

const desc = "<p>Buscamos analista de marketing digital para campañas de Google Ads y Meta Ads, reportes de performance y optimización de presupuesto.</p>".repeat(3);
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const html = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });

describe("Breezy HR (JSON del sitio de empleo)", () => {
  const board: Board = { sourceId: "breezy", boardId: "breezy:rockcruit", slug: "rockcruit", company: "Rockcruit" };
  const remote = {
    id: "387009f9721d",
    friendly_id: "387009f9721d-cg1-account-manager-b2b",
    name: "CG1 - Account Manager B2B",
    url: "https://rockcruit.breezy.hr/p/387009f9721d-cg1-account-manager-b2b",
    published_date: "2026-08-31T16:25:57.119Z",
    type: { id: "fullTime", name: "Full-Time" },
    location: { country: { name: "Argentina", id: "AR" }, primary: true, is_remote: true, remote_details: { value: "remote-location", label: "Fully remote, within chosen location(s)" }, name: "Argentina" },
    department: null,
    salary: "",
    company: { name: "Rockcruit", logo_url: "https://gallery-cdn.breezy.hr/d986/ROCKCRUIT_Logo 1.png" },
  };
  const onsite = { ...remote, id: "8a50669e339e", friendly_id: "8a50669e339e-ejecutivo", name: "BO1 - Ejecutivo/a de Ventas Senior", url: "https://rockcruit.breezy.hr/p/8a50669e339e-ejecutivo", location: { country: { name: "Argentina", id: "AR" }, city: "Buenos Aires", is_remote: false, name: "Buenos Aires, AR" } };
  const page = `<html><body><div class="position-header"><h1>CG1</h1></div><div class="job-description"><div class="description">${desc}</div></div><div class="apply-button">Postularme</div><footer>Breezy</footer></body></html>`;

  it("toma la descripción del aviso sin la postulación ni el pie", () => {
    const text = breezyDescription(page);
    expect(text).toContain("Google Ads y Meta Ads");
    expect(text).not.toMatch(/Postularme|Breezy/);
    expect(breezyDescription("<html>sin descripción</html>")).toBe("");
  });

  it("remoto dentro de Argentina queda como condición de residencia, no como oficina", () => {
    const p = normalizeBreezy(remote, board, "texto");
    expect(p).toMatchObject({ externalId: "387009f9721d", company: "Rockcruit", countries: [], regionText: ["Argentina"], locations: ["Argentina"], employmentHint: "Full-Time", applyUrl: "https://rockcruit.breezy.hr/p/387009f9721d-cg1-account-manager-b2b/apply", publishedAt: "2026-08-31T16:25:57.119Z" });
    expect(p.workplace).toMatchObject({ value: "remoto", from: "fuente" });
    expect(p.companyLogo).toBe("https://gallery-cdn.breezy.hr/d986/ROCKCRUIT_Logo%201.png");
    const q = normalizeBreezy(onsite, board);
    expect(q).toMatchObject({ countries: ["AR"], regionText: [], locations: ["Buenos Aires, AR"] });
  });

  it("lee la lista y la página de cada aviso; los avisos quedan elegibles desde Argentina", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return String(url).endsWith("/json") ? json([remote, onsite]) : html(page);
    }) as typeof fetch;
    const res = await fetchBreezy(board, { fetchImpl, retries: 0 });
    expect(calls[0]).toBe("https://rockcruit.breezy.hr/json");
    expect(calls).toHaveLength(3);
    expect(res).toMatchObject({ complete: true, received: 2 });
    const inv = emptyInventory("fixture");
    applyBoard(inv, board.boardId, "breezy", { postings: res.postings, complete: true }, "2026-10-18T00:00:00.000Z");
    expect(inv.postings.map((p) => p.eligibility.status)).toEqual(["elegible", "elegible"]);
    await expect(fetchBreezy({ ...board, slug: "a.b" }, { retries: 0 })).rejects.toThrow(/inválida/);
  });
});

describe("BambooHR (API del sitio de empleo)", () => {
  const board: Board = { sourceId: "bamboohr", boardId: "bamboohr:satellogic", slug: "satellogic", company: "Satellogic" };
  const listItem = { id: "554", jobOpeningName: "Hardware Design Engineer", departmentLabel: "RDO", employmentStatusLabel: "Full-Time", location: { city: "Buenos Aires", state: "Argentina" }, isRemote: null, locationType: "2" };
  const detail = { jobOpeningShareUrl: "https:\\/\\/satellogic.bamboohr.com\\/careers\\/554", jobOpeningName: "Hardware Design Engineer", jobOpeningStatus: "Open", departmentLabel: "RDO", employmentStatusLabel: "Full-Time", location: { city: "Buenos Aires", state: "Argentina", postalCode: "1425", addressCountry: "Argentina" }, description: desc, compensation: null, datePosted: "2026-07-13", locationType: "2" };

  it("normaliza modalidad por locationType, ubicación y país sin repetir", () => {
    const p = normalizeBamboo(detail, board, "554");
    expect(p).toMatchObject({ externalId: "554", company: "Satellogic", locations: ["Buenos Aires, Argentina"], countries: ["AR"], department: "RDO", sourceUrl: "https://satellogic.bamboohr.com/careers/554", publishedAt: "2026-07-13T00:00:00.000Z" });
    expect(p.workplace).toMatchObject({ value: "hibrido", evidence: "locationType: 2" });
    expect(p.descriptionComplete).toBe(true);
    const remote = normalizeBamboo({ ...detail, location: { city: "Argentina, Spain, Uruguay", state: " or Remote" }, locationType: "1" }, board, "580");
    expect(remote).toMatchObject({ countries: [], regionText: ["Argentina", "Spain", "Uruguay"] });
  });

  it("lee la lista y el detalle de cada aviso", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return String(url).endsWith("/list") ? json({ meta: { totalCount: 1 }, result: [listItem, { ...listItem, id: "../x" }] }) : json({ meta: {}, result: { jobOpening: detail, formFields: {} } });
    }) as typeof fetch;
    const res = await fetchBamboo(board, { fetchImpl, retries: 0 });
    expect(calls).toEqual(["https://satellogic.bamboohr.com/careers/list", "https://satellogic.bamboohr.com/careers/554/detail"]);
    expect(res.postings).toHaveLength(1);
    const inv = emptyInventory("fixture");
    applyBoard(inv, board.boardId, "bamboohr", { postings: res.postings, complete: true }, "2026-10-18T00:00:00.000Z");
    expect(inv.postings[0].eligibility.status).toBe("elegible");
  });
});

describe("directorio", () => {
  it("las empresas con Breezy o BambooHR entran a la sincronización", () => {
    const boards = boardsFrom({ reviewedAt: "", companies: [
      { name: "Rockcruit", sourceId: "breezy", slug: "rockcruit", evidence: "x", addedAt: "", status: "candidata" },
      { name: "Satellogic", sourceId: "bamboohr", slug: "satellogic", evidence: "x", addedAt: "", status: "candidata" },
    ] }, {});
    expect(boards.map((b) => b.boardId)).toEqual(expect.arrayContaining(["breezy:rockcruit", "bamboohr:satellogic"]));
  });
});
