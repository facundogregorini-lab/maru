import { describe, expect, it } from "vitest";
import { eightfoldDomain, fetchEightfold, inDetailWindow, fetchRecruitee, fetchSmartRecruiters, fetchSuccessFactors, fetchWorkday, normalizeEightfold, normalizeRecruitee, normalizeSmartRecruiters, normalizeSuccessFactors, normalizeWorkday, parseSuccessFactorsSearch, successFactorsSite, workdaySite, type Board } from "@/lib/match/connectors";
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

describe("Eightfold (API del sitio de empleo)", () => {
  const board: Board = { sourceId: "eightfold", boardId: "eightfold:mercadolibre.eightfold.ai", slug: "mercadolibre.eightfold.ai", company: "Mercado Libre" };
  const pos = { id: 44853699, name: "Analista de Marketing Performance", locations: ["Buenos Aires, Argentina"], department: "Marketing", t_create: 1792000000, canonicalPositionUrl: "https://mercadolibre.eightfold.ai/careers/job/44853699", work_location_option: "hybrid" };

  it("deriva el dominio de la empresa y normaliza el aviso", () => {
    expect(eightfoldDomain("mercadolibre.eightfold.ai")).toBe("mercadolibre.com");
    expect(eightfoldDomain("careers.haleon.com")).toBe("haleon.com");
    const p = normalizeEightfold({ ...pos, job_description: desc }, board);
    expect(p).toMatchObject({ externalId: "44853699", company: "Mercado Libre", countries: ["AR"], department: "Marketing", applyUrl: pos.canonicalPositionUrl });
    expect(p.workplace.value).toBe("hibrido");
  });

  it("pide Argentina por página y el detalle si falta la descripción", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return String(url).includes("/jobs?") ? json({ count: 1, positions: [pos] }) : json({ ...pos, job_description: desc });
    }) as typeof fetch;
    const res = await fetchEightfold(board, { fetchImpl, retries: 0 });
    expect(calls).toEqual(["https://mercadolibre.eightfold.ai/api/apply/v2/jobs?domain=mercadolibre.com&location=Argentina&start=0&num=20", "https://mercadolibre.eightfold.ai/api/apply/v2/jobs/44853699?domain=mercadolibre.com"]);
    expect(res).toMatchObject({ complete: true, received: 1 });
    expect(res.postings[0].descriptionText).toContain("tesorería");
  });
});

describe("SuccessFactors (página de búsqueda)", () => {
  const board: Board = { sourceId: "successfactors", boardId: "successfactors:careers.ey.com~ey", slug: "careers.ey.com~ey", company: "EY" };
  const row = (id: number, title: string) => `<tr class="data-row"><td class="colTitle"><span class="jobTitle hidden-phone"><a href="/ey/job/Buenos-Aires-${id}/${id}/" class="jobTitle-link">${title}</a></span></td><td class="colLocation"><span class="jobLocation">Buenos Aires, AR</span></td></tr>`;
  const search = (rows: string[], total: number) => `<html><body><span class="paginationLabel">Resultados <b>1 – ${rows.length}</b> de <b>${total}</b></span><table id="searchresults"><tbody>${rows.join("")}</tbody></table></body></html>`;
  const detail = `<html><head><meta itemprop="datePosted" content="2026-10-15"></head><body><span class="jobdescription">${desc}</span></body></html>`;

  it("valida el sitio y lee filas, ubicación y total", () => {
    expect(successFactorsSite("careers.ey.com~ey")).toEqual({ host: "careers.ey.com", prefix: "/ey" });
    expect(() => successFactorsSite("careers.ey.com/../x")).toThrow(/inválido/);
    const parsed = parseSuccessFactorsSearch(search([row(1440520500, "Analista de Costos &amp; Presupuesto")], 1));
    expect(parsed).toEqual({ total: 1, perPage: null, rows: [{ title: "Analista de Costos & Presupuesto", path: "/ey/job/Buenos-Aires-1440520500/1440520500/", location: "Buenos Aires, AR" }] });
  });

  it("busca Argentina, lee el detalle y normaliza", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(String(url).includes("/search/") ? search([row(1448547733, "Analista Junior de Riesgos")], 1) : detail);
    }) as typeof fetch;
    const res = await fetchSuccessFactors(board, { fetchImpl, retries: 0 });
    expect(calls[0]).toBe("https://careers.ey.com/ey/search/?q=&locationsearch=Argentina&startrow=0");
    expect(res).toMatchObject({ complete: true, received: 1 });
    expect(res.postings[0]).toMatchObject({ externalId: "1448547733", countries: ["AR"], sourceUrl: "https://careers.ey.com/ey/job/Buenos-Aires-1448547733/1448547733/", publishedAt: "2026-10-15T00:00:00.000Z" });
    expect(res.postings[0].descriptionText).toContain("conciliaciones");
  });

  it("si la página no tiene el formato esperado, falla en vez de vaciar la bolsa", async () => {
    const fetchImpl = (async () => new Response("<html><body><div id='app'></div></body></html>")) as unknown as typeof fetch;
    await expect(fetchSuccessFactors(board, { fetchImpl, retries: 0 })).rejects.toThrow(/formato/);
    const empty = (async () => new Response("<html><body>No results found</body></html>")) as unknown as typeof fetch;
    await expect(fetchSuccessFactors(board, { fetchImpl: empty, retries: 0 })).resolves.toMatchObject({ received: 0 });
  });
});

describe("SuccessFactors con mosaico (li.job-tile)", () => {
  const board: Board = { sourceId: "successfactors", boardId: "successfactors:empleos.ejemplo.com.ar", slug: "empleos.ejemplo.com.ar", company: "Ejemplo SA" };
  // Campo de un mosaico, como lo arma el sitio: id con la versión (desktop, tablet, mobile), etiqueta y valor.
  const field = (id: number, view: string, name: string, label: string, value: string) =>
    `<div id="job-${id}-${view}-section-${name}" data-focus-tile=".job-id-${id}" class="section-field ${name}"><span id="job-${id}-${view}-section-${name}-label" class="section-label">${label}</span><div id="job-${id}-${view}-section-${name}-value">${value}\n</div></div>`;
  const link = (id: number, title: string) =>
    `<div class="tiletitle"><span class="sr-only">Título</span><span class="col-md-12 section-title title" role="heading" aria-level="2"><a class="jobTitle-link fontcolor1" data-focus-tile=".job-id-${id}" href="/job/Ciudad-Puesto-${id}/${id}/">\n  ${title}\n</a></span></div>`;
  // El mismo aviso aparece tres veces (escritorio, tablet y celular); los campos extra los elige cada empresa.
  const tile = (id: number, title: string, fields: [string, string, string][] = []) =>
    `<li class="job-tile job-id-${id} job-row-index-1" data-url="/job/Ciudad-Puesto-${id}/${id}/"><div class="job-tile-cell"><div class="row job job-row">` +
    ["desktop", "tablet", "mobile"].map((view) => `<div class="sub-section sub-section-${view}"><div class="oneline">${link(id, title)}</div><div class="oneline">${fields.map(([n, l, v]) => field(id, view, n, l, v)).join("")}</div></div>`).join("") +
    `</div></div></li>`;
  const search = (tiles: string[], from: number, total: number, perPage = 25) =>
    `<html><body><div role="region"><span id="tile-search-results-label">Mostrando ${from} a ${from + tiles.length - 1} de ${total} puestos</span><label id="searchresultslabel" class="sr-only">Resultados</label><ul id="job-tile-list" class="container job-list" data-per-page="${perPage}" data-record-returned="${tiles.length}">${tiles.join("")}</ul></div><footer><a href="/content/Privacidad/">Privacidad</a></footer></body></html>`;
  const detail = `<html><body><div class="jobDisplayShell" itemscope="itemscope" itemtype="http://schema.org/JobPosting"><span itemprop="jobLocation"><span itemprop="address"><meta itemprop="addressCountry" content="AR"></span></span><meta itemprop="datePosted" content="Thu Oct 15 00:00:00 UTC 2026"><div class="job"><span itemprop="description" class="jobdescription">${desc}</span></div></div><footer>pie</footer></body></html>`;

  it("lee título, enlace, ubicación (con la etiqueta que use la empresa), total y tamaño de página", () => {
    const html = search(
      [
        tile(1440000001, "Analista de Costos &amp; Presupuesto", [["customfield1", "Id de vacante", "121744"], ["customfield3", "Ubicación", "CAPITAL FEDERAL"]]),
        tile(1440000002, "Asesor/a Comercial | Bahía Blanca", [["location", "Ubicación", "Bahía Blanca"], ["customfield1", "Modalidad de Trabajo", "Híbrido"]]),
        tile(1440000003, "Pasante de Administración"),
      ],
      1,
      51,
    );
    expect(parseSuccessFactorsSearch(html)).toEqual({
      total: 51,
      perPage: 25,
      rows: [
        { title: "Analista de Costos & Presupuesto", path: "/job/Ciudad-Puesto-1440000001/1440000001/", location: "CAPITAL FEDERAL" },
        { title: "Asesor/a Comercial | Bahía Blanca", path: "/job/Ciudad-Puesto-1440000002/1440000002/", location: "Bahía Blanca" },
        { title: "Pasante de Administración", path: "/job/Ciudad-Puesto-1440000003/1440000003/", location: "" },
      ],
    });
  });

  it("pagina con el tamaño del sitio (de a 5), lee el detalle y da por argentinos los avisos sin ubicación", async () => {
    const calls: string[] = [];
    const ids = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => 1439000000 + n);
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      if (!String(url).includes("/search/")) return new Response(detail);
      const start = Number(new URL(String(url)).searchParams.get("startrow"));
      return new Response(search(ids.slice(start, start + 5).map((id) => tile(id, `Puesto ${id}`)), start + 1, ids.length, 5));
    }) as typeof fetch;
    const res = await fetchSuccessFactors(board, { fetchImpl, retries: 0 });
    expect(calls.filter((c) => c.includes("/search/"))).toEqual([
      "https://empleos.ejemplo.com.ar/search/?q=&locationsearch=Argentina&startrow=0",
      "https://empleos.ejemplo.com.ar/search/?q=&locationsearch=Argentina&startrow=5",
    ]);
    expect(res).toMatchObject({ complete: true, received: 8 });
    expect(res.postings[0]).toMatchObject({ externalId: "1439000001", company: "Ejemplo SA", countries: ["AR"], locations: [], sourceUrl: "https://empleos.ejemplo.com.ar/job/Ciudad-Puesto-1439000001/1439000001/", publishedAt: "2026-10-15T00:00:00.000Z" });
    expect(res.postings[0].descriptionText).toContain("conciliaciones");
    const inv = emptyInventory("fixture");
    applyBoard(inv, board.boardId, "successfactors", { postings: res.postings, complete: true }, "2026-10-17T00:00:00.000Z");
    expect(inv.postings[0].eligibility.status).toBe("elegible");
  });

  it("si el sitio ignora startrow y repite la primera página, corta sin dar la lectura por completa", async () => {
    const page = search([1, 2, 3, 4, 5].map((n) => tile(1438000000 + n, `Puesto ${n}`)), 1, 40, 5);
    const fetchImpl = (async () => new Response(page)) as unknown as typeof fetch;
    const res = await fetchSuccessFactors(board, { fetchImpl, retries: 0 });
    expect(res).toMatchObject({ complete: false, received: 5 });
  });

  it("un mosaico sin enlaces a avisos sigue fallando en vez de vaciar la bolsa; el aviso de sin resultados no", async () => {
    const fetchImpl = (async () => new Response(`<html><body><ul id="job-tile-list" data-per-page="25"><li class="job-tile"><div>Sin enlace</div></li></ul></body></html>`)) as unknown as typeof fetch;
    await expect(fetchSuccessFactors(board, { fetchImpl, retries: 0 })).rejects.toThrow(/formato/);
    const empty = (async () => new Response(`<html><body><div id="noresults" class="alert alert-block"><div id="attention"><label>En este momento, no hay ninguna vacante acorde a sus preferencias.</label></div></div></body></html>`)) as unknown as typeof fetch;
    await expect(fetchSuccessFactors(board, { fetchImpl: empty, retries: 0 })).resolves.toMatchObject({ received: 0, complete: true });
  });
});

describe("SuccessFactors: descripción con etiquetas anidadas", () => {
  it("no corta en el primer cierre interno", () => {
    const board: Board = { sourceId: "successfactors", boardId: "successfactors:oportunidades.ypf.com", slug: "oportunidades.ypf.com", company: "YPF" };
    const html = `<span class="jobdescription"><p><span>Primera parte.</span></p><p>${"Segunda parte con tareas de costos y presupuesto. ".repeat(6)}</p></span><div class="applylink">Postularme</div><footer>pie</footer>`;
    const p = normalizeSuccessFactors({ title: "Analista de Costos", path: "/job/Federal-ANALISTA-COSTOS/1440520500/", location: "Buenos Aires, AR" }, html, board);
    expect(p.descriptionText).toContain("Segunda parte");
    expect(p.descriptionText).not.toContain("Postularme");
  });
});

describe("detalle de a tandas", () => {
  it("la ventana rota por día y cubre todos los avisos", () => {
    const day = 86_400_000;
    const seen = new Set<number>();
    for (let d = 0; d < 6; d++) for (let i = 0; i < 230; i++) if (inDetailWindow(i, 230, 40, d * day)) seen.add(i);
    expect(seen.size).toBe(230);
    expect([...Array(230).keys()].filter((i) => inDetailWindow(i, 230, 40, 3 * day))).toHaveLength(40);
    expect(inDetailWindow(25, 30, 40)).toBe(true);
  });

  it("un aviso que vuelve sin detalle conserva la descripción ya leída", () => {
    const board: Board = { sourceId: "successfactors", boardId: "successfactors:careers.ey.com~ey", slug: "careers.ey.com~ey", company: "EY" };
    const row = { title: "Analista Contable", path: "/ey/job/Buenos-Aires-1234567/1234567/", location: "CABA, B, AR, 1001 +2 more…" };
    const withDesc = normalizeSuccessFactors(row, `<html><body><span class="jobdescription">${desc}</span></body></html>`, board);
    expect(withDesc.locations).toEqual(["CABA, Argentina"]);
    const inv = emptyInventory("fixture");
    applyBoard(inv, board.boardId, "successfactors", { postings: [withDesc], complete: true }, "2026-10-18T00:00:00.000Z");
    applyBoard(inv, board.boardId, "successfactors", { postings: [normalizeSuccessFactors(row, null, board)], complete: true }, "2026-10-19T00:00:00.000Z");
    expect(inv.postings[0].descriptionText).toContain("conciliaciones bancarias");
    expect(inv.postings[0].descriptionComplete).toBe(true);
  });
});
