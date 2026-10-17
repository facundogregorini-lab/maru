import { describe, expect, it } from "vitest";
import { fetchRecruitee, fetchSmartRecruiters, fetchWorkday, normalizeRecruitee, normalizeSmartRecruiters, normalizeWorkday, workdaySite, type Board } from "@/lib/match/connectors";
import { boardsFrom } from "@/lib/match/directory";
import { applyBoard, emptyInventory } from "@/lib/match/inventory";

const desc = "<p>Buscamos analista de tesorería para conciliaciones bancarias, flujo de fondos y reportes de gestión mensuales con Excel avanzado y SAP.</p>".repeat(3);
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

describe("SmartRecruiters (Posting API pública)", () => {
  const board: Board = { sourceId: "smartrecruiters", boardId: "smartrecruiters:acmesa", slug: "AcmeSA", company: "Acme SA" };
  const item = { id: "7440001", name: "Analista de Tesorería", releasedDate: "2026-10-15T12:00:00.000Z", location: { city: "Rosario", region: "Santa Fe", country: "ar", hybrid: true }, department: { label: "Finanzas" }, typeOfEmployment: { label: "Full-time" }, experienceLevel: { label: "Mid-Senior Level" } };

  it("normaliza ubicación, modalidad, área, contrato y nivel", () => {
    const p = normalizeSmartRecruiters({ ...item, jobAd: { sections: { jobDescription: { text: desc } } } }, board);
    expect(p).toMatchObject({ externalId: "7440001", company: "Acme SA", locations: ["Rosario, Santa Fe, AR"], countries: ["AR"], department: "Finanzas", employmentHint: "Full-time", seniorityHint: "Mid-Senior Level", sourceUrl: "https://jobs.smartrecruiters.com/AcmeSA/7440001", publishedAt: "2026-10-15T12:00:00.000Z" });
    expect(p.workplace).toMatchObject({ value: "hibrido", from: "fuente" });
    expect(p.descriptionText).toContain("conciliaciones bancarias");
  });

  it("pide sólo Argentina, pagina y lee el detalle de cada aviso", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      if (String(url).includes("/postings?")) return json({ totalFound: 1, content: [item] });
      return json({ ...item, jobAd: { sections: { jobDescription: { text: desc } } } });
    }) as typeof fetch;
    const res = await fetchSmartRecruiters(board, { fetchImpl, retries: 0 });
    expect(calls).toEqual(["https://api.smartrecruiters.com/v1/companies/AcmeSA/postings?country=ar&limit=100&offset=0", "https://api.smartrecruiters.com/v1/companies/AcmeSA/postings/7440001"]);
    expect(res).toMatchObject({ complete: true, received: 1 });
    const inv = emptyInventory("fixture");
    applyBoard(inv, board.boardId, "smartrecruiters", { postings: res.postings, complete: true }, "2026-10-17T00:00:00.000Z");
    expect(inv.postings[0].eligibility.status).toBe("elegible");
    expect(inv.postings[0].extracted.family.value).toBe("finanzas");
  });
});

describe("Recruitee (API del sitio de empleo)", () => {
  const board: Board = { sourceId: "recruitee", boardId: "recruitee:cocos", slug: "cocos", company: "Cocos" };
  const offer = { id: 991, slug: "analista-contable", title: "Analista Contable", description: desc, requirements: "<ul><li>Contador público</li></ul>", city: "Buenos Aires", country: "Argentina", country_code: "AR", remote: false, hybrid: true, department: "Administración", employment_type_code: "fulltime", careers_url: "https://cocos.recruitee.com/o/analista-contable", careers_apply_url: "https://cocos.recruitee.com/o/analista-contable/c/new", published_at: "2026-10-10 14:00:00 UTC" };

  it("normaliza la oferta y suma los requisitos a la descripción", () => {
    const p = normalizeRecruitee(offer, board);
    expect(p).toMatchObject({ externalId: "991", company: "Cocos", countries: ["AR"], applyUrl: "https://cocos.recruitee.com/o/analista-contable/c/new", department: "Administración" });
    expect(p.workplace.value).toBe("hibrido");
    expect(p.descriptionText).toContain("Contador público");
  });

  it("lee todas las ofertas en un pedido y valida la cuenta", async () => {
    const fetchImpl = (async () => json({ offers: [offer] })) as unknown as typeof fetch;
    const res = await fetchRecruitee(board, { fetchImpl, retries: 0 });
    expect(res).toMatchObject({ complete: true, received: 1 });
    await expect(fetchRecruitee({ ...board, slug: "a.b" }, { retries: 0 })).rejects.toThrow(/inválida/);
  });
});

describe("directorio", () => {
  it("las empresas con SmartRecruiters o Recruitee entran a la sincronización", () => {
    const boards = boardsFrom({ reviewedAt: "", companies: [
      { name: "Acme", sourceId: "smartrecruiters", slug: "AcmeSA", evidence: "x", addedAt: "", status: "candidata" },
      { name: "Cocos", sourceId: "recruitee", slug: "cocos", evidence: "x", addedAt: "", status: "candidata" },
    ] }, {});
    expect(boards.map((b) => b.boardId)).toEqual(expect.arrayContaining(["smartrecruiters:acmesa", "recruitee:cocos"]));
  });
});

describe("Workday (búsqueda del sitio de empleo)", () => {
  const board: Board = { sourceId: "workday", boardId: "workday:acme.wd3.careers", slug: "acme.wd3.Careers", company: "Acme" };
  const item = { title: "Financial Analyst", externalPath: "/job/Buenos-Aires/Financial-Analyst_R123", locationsText: "Buenos Aires", postedOn: "Posted 2 Days Ago", bulletFields: ["R123"] };
  const detail = { jobPostingInfo: { title: "Financial Analyst", jobDescription: desc, location: "Buenos Aires, Argentina", startDate: "2026-10-15", timeType: "Full time", jobReqId: "R123", externalUrl: "https://acme.wd3.myworkdayjobs.com/Careers/job/Buenos-Aires/Financial-Analyst_R123", remoteType: "Hybrid", country: { descriptor: "Argentina" } } };

  it("valida el sitio y normaliza el detalle", () => {
    expect(() => workdaySite("acme/Careers")).toThrow(/inválido/);
    const p = normalizeWorkday(item, detail, board);
    expect(p).toMatchObject({ externalId: "R123", company: "Acme", countries: ["AR"], employmentHint: "Full time", publishedAt: "2026-10-15T00:00:00.000Z", applyUrl: detail.jobPostingInfo.externalUrl });
    expect(p.workplace.value).toBe("hibrido");
    expect(normalizeWorkday(item, null, board).sourceUrl).toBe("https://acme.wd3.myworkdayjobs.com/Careers/job/Buenos-Aires/Financial-Analyst_R123");
  });

  it("busca Argentina por POST, de a 20, y lee el detalle", async () => {
    const calls: { url: string; method?: string; body?: string }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method, body: init?.body as string | undefined });
      return String(url).endsWith("/jobs") ? json({ total: 1, jobPostings: [item] }) : json(detail);
    }) as typeof fetch;
    const res = await fetchWorkday(board, { fetchImpl, retries: 0 });
    expect(calls[0]).toMatchObject({ url: "https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/Careers/jobs", method: "POST" });
    expect(JSON.parse(calls[0].body!)).toMatchObject({ limit: 20, offset: 0, searchText: "Argentina" });
    expect(calls[1].url).toBe("https://acme.wd3.myworkdayjobs.com/wday/cxs/acme/Careers/job/Buenos-Aires/Financial-Analyst_R123");
    expect(res).toMatchObject({ complete: true, received: 1 });
    expect(res.postings[0].descriptionText).toContain("tesorería");
  });
});
