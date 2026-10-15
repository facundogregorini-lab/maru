import { describe, expect, it } from "vitest";
import {
  fetchAshby,
  fetchGetonbrd,
  fetchGreenhouse,
  fetchJobicy,
  fetchLever,
  fetchRemotive,
  parseBoardUrl,
} from "@/lib/match/connectors";
import { classifyEligibility } from "@/lib/match/eligibility";
import { extract, familyFromTitle, seniorityFromTitle } from "@/lib/match/extract";
import { fetchJson } from "@/lib/match/http";
import { htmlToText } from "@/lib/match/text";
import type { NormalizedPosting } from "@/lib/match/types";
import { BOARDS, fakeFetch, fixture, noSleep } from "./match-helpers";

const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });

describe("conectores", () => {
  it("Greenhouse: decodifica el HTML escapado y conserva la URL del empleador", async () => {
    const r = await fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api.greenhouse.io/v1/boards/acmepagos/jobs": fixture("greenhouse-board.json") }));
    expect(r.complete).toBe(true);
    expect(r.postings).toHaveLength(5);
    const p = r.postings.find((x) => x.externalId === "101")!;
    expect(p.descriptionText).toContain("Advanced SQL and Python");
    expect(p.descriptionText).not.toContain("<li>");
    expect(p.applyUrl).toBe("https://job-boards.greenhouse.io/acmepagos/jobs/101");
    expect(p.company).toBe("Acme Pagos");
    expect(p.publishedAt).toBe("2026-09-28T14:00:00.000Z");
  });

  it("Lever: pagina, toma salario publicado y país informado", async () => {
    const r = await fetchLever(BOARDS.lever, { ...opts({ "https://api.lever.co/v0/postings/acmelever": fixture("lever-postings.json") }), pageSize: 100 });
    expect(r.complete).toBe(true);
    const growth = r.postings.find((p) => p.title === "Growth Marketing Manager")!;
    expect(growth.salary?.value).toMatchObject({ min: 3000, max: 4000, currency: "USD", period: "mes" });
    expect(growth.workplace.value).toBe("hibrido");
    expect(growth.countries).toEqual(["AR"]);
    expect(growth.employmentHint).toBe("Full-time");
  });

  it("Ashby: excluye avisos no listados y no usa la sede como país en remotos", async () => {
    const r = await fetchAshby(BOARDS.ashby, opts({ "https://api.ashbyhq.com/posting-api/job-board/acmeashby": fixture("ashby-board.json") }));
    expect(r.postings.map((p) => p.title)).not.toContain("Internal Only Role");
    const backend = r.postings.find((p) => p.title === "Backend Engineer")!;
    expect(backend.countries).toEqual([]);
    const csm = r.postings.find((p) => p.title === "Customer Success Manager")!;
    expect(csm.countries).toEqual(["AR"]);
    expect(csm.salary?.value).toMatchObject({ min: 30000, max: 40000, currency: "USD", period: "anio" });
  });

  it("Remotive y Jobicy exigen enlace y atribución de la fuente", async () => {
    const rem = await fetchRemotive(BOARDS.remotive, opts({ "https://remotive.com/api/remote-jobs": fixture("remotive.json") }));
    expect(rem.postings.every((p) => p.linkRequired && p.attribution === "Publicado en Remotive")).toBe(true);
    expect(rem.postings[0].applyUrl).toContain("remotive.com");
    const jb = await fetchJobicy(BOARDS.jobicy, opts({ "https://jobicy.com/api/v2/remote-jobs": fixture("jobicy.json") }));
    expect(jb.complete).toBe(false); // feed parcial: sólo los últimos avisos
    expect(jb.postings.find((p) => p.externalId === "7001")!.regionText).toEqual([]); // "Anywhere" = sin dato
  });

  it("Get on Board: recorre categorías y lee países", async () => {
    const f = fixture<{ categories: unknown; jobs: unknown }>("getonbrd.json");
    const r = await fetchGetonbrd(BOARDS.getonbrd, { ...opts({ "https://www.getonbrd.com/api/v0/categories?": f.categories, "https://www.getonbrd.com/api/v0/categories/sales/jobs": f.jobs }), sleep: noSleep });
    expect(r.postings).toHaveLength(1);
    expect(r.postings[0].countries).toEqual(["AR", "CL"]);
    expect(r.postings[0].company).toBe("Acme Sur");
    expect(r.postings[0].descriptionText).toContain("Deseable:");
  });

  it("detecta ATS y slug desde URLs de bolsas y avisos", () => {
    expect(parseBoardUrl("https://job-boards.greenhouse.io/clara/jobs/5199145007")).toMatchObject({ sourceId: "greenhouse", slug: "clara", jobId: "5199145007" });
    expect(parseBoardUrl("https://job-boards.eu.greenhouse.io/remotepeople")).toMatchObject({ sourceId: "greenhouse", region: "eu" });
    expect(parseBoardUrl("https://jobs.lever.co/despegar?location=Buenos+Aires")).toMatchObject({ sourceId: "lever", slug: "despegar" });
    expect(parseBoardUrl("https://jobs.ashbyhq.com/whippy/3d37adc5-9e04-4ff2-b19d-cc32945f4429")).toMatchObject({ sourceId: "ashby", slug: "whippy" });
    expect(parseBoardUrl("https://www.linkedin.com/jobs/view/123")).toBeNull();
  });
});

describe("HTTP con reintentos", () => {
  it("respeta Retry-After y reintenta un número limitado de veces", async () => {
    let n = 0;
    const waits: number[] = [];
    const impl = (async () => {
      n++;
      return n < 3 ? new Response("", { status: 429, headers: { "retry-after": "2" } }) : new Response('{"ok":1}', { status: 200 });
    }) as typeof fetch;
    const out = await fetchJson<{ ok: number }>("https://x.test/a", { fetchImpl: impl, sleep: async (ms) => void waits.push(ms), retries: 3 });
    expect(out.ok).toBe(1);
    expect(waits).toEqual([2000, 2000]);
  });

  it("no reintenta errores 404 y corta tras los reintentos permitidos", async () => {
    let n = 0;
    const impl404 = (async () => (n++, new Response("", { status: 404 }))) as typeof fetch;
    await expect(fetchJson("https://x.test/b", { fetchImpl: impl404, sleep: noSleep })).rejects.toThrow("HTTP 404");
    expect(n).toBe(1);
    let m = 0;
    const impl500 = (async () => (m++, new Response("", { status: 503 }))) as typeof fetch;
    await expect(fetchJson("https://x.test/c", { fetchImpl: impl500, sleep: noSleep, retries: 2 })).rejects.toThrow("HTTP 503");
    expect(m).toBe(3);
  });
});

const posting = (over: Partial<NormalizedPosting>): NormalizedPosting => ({
  sourceId: "greenhouse",
  boardId: "greenhouse:x",
  externalId: "1",
  title: "Analyst",
  company: "X",
  sourceUrl: "https://x/1",
  applyUrl: "https://x/1",
  linkRequired: false,
  descriptionText: "",
  descriptionComplete: true,
  locations: [],
  countries: [],
  regionText: [],
  workplace: { value: "desconocido", from: "fuente" },
  remoteFlag: null,
  employmentType: null,
  salary: null,
  publishedAt: null,
  updatedAt: null,
  expiresAt: null,
  ...over,
});

describe("elegibilidad desde Argentina", () => {
  const remote = { value: "remoto" as const, from: "fuente" as const };
  it("US only queda excluido", () => {
    expect(classifyEligibility(posting({ locations: ["Remote - US"], workplace: remote })).status).toBe("no_elegible");
    expect(classifyEligibility(posting({ regionText: ["USA Only"], workplace: remote })).status).toBe("no_elegible");
    expect(classifyEligibility(posting({ locations: ["Remote"], workplace: remote, descriptionText: "Must be authorized to work in the United States." })).status).toBe("no_elegible");
  });
  it("LATAM, South America y Worldwide son elegibles", () => {
    for (const r of ["LATAM", "Remote - Latin America", "South America", "Worldwide"]) {
      expect(classifyEligibility(posting({ regionText: [r], workplace: remote })).status).toBe("elegible");
    }
  });
  it("Remote a secas queda por confirmar", () => {
    const e = classifyEligibility(posting({ locations: ["Remote"], workplace: remote }));
    expect(e.status).toBe("por_confirmar");
    expect(e.evidence[0]).toMatch(/no dice si contratan desde Argentina/);
  });
  it("Buenos Aires es elegible; Córdoba, España no", () => {
    expect(classifyEligibility(posting({ locations: ["Buenos Aires, Argentina"] })).status).toBe("elegible");
    expect(classifyEligibility(posting({ locations: ["Córdoba, Spain"] })).status).toBe("no_elegible");
  });
  it("LATAM con pedido de permiso en EE. UU. queda por confirmar", () => {
    expect(classifyEligibility(posting({ regionText: ["LATAM"], workplace: remote, descriptionText: "You must be authorized to work in the US." })).status).toBe("por_confirmar");
  });
  it("una zona horaria no otorga elegibilidad", () => {
    const e = classifyEligibility(posting({ locations: ["Remote"], workplace: remote, descriptionText: "Must overlap with EST business hours (UTC-5)." }));
    expect(e.status).toBe("por_confirmar");
    expect(e.timezone).toBeDefined();
  });
  it("Americas es ambiguo; países vacíos son desconocidos", () => {
    expect(classifyEligibility(posting({ regionText: ["Americas"], workplace: remote })).status).toBe("por_confirmar");
    expect(classifyEligibility(posting({})).status).toBe("por_confirmar");
  });
  it("país estructurado sin Argentina excluye", () => {
    expect(classifyEligibility(posting({ countries: ["BR"], locations: ["Remote - Brazil"], workplace: remote })).status).toBe("no_elegible");
  });
});

describe("extracción por reglas", () => {
  it("separa obligatorios de deseables y detecta idioma y años", () => {
    const text = htmlToText(fixture<{ jobs: { id: number; content: string }[] }>("greenhouse-board.json").jobs[0].content);
    const ex = extract({ title: "Senior Data Analyst", descriptionText: text });
    expect(ex.skillsRequired).toEqual(expect.arrayContaining(["sql", "python", "tableau"]));
    expect(ex.skillsDesirable).toContain("looker");
    expect(ex.skillsRequired).not.toContain("looker");
    expect(ex.languages[0]).toMatchObject({ language: "inglés", required: true });
    expect(ex.yearsRequired).toBe(4);
    expect(ex.seniority?.value).toBe("senior");
    expect(ex.family.value).toBe("datos");
  });
  it("no confunde 'Product Manager' con gestión de personas", () => {
    expect(seniorityFromTitle("Product Manager")).toBeNull();
    expect(seniorityFromTitle("Engineering Manager")).toBe("manager");
    expect(familyFromTitle("Ejecutivo Comercial")).toBe("ventas");
    expect(familyFromTitle("Asistente administrativa")).toBe("administracion");
  });
  it("no inventa datos: sin información, quedan vacíos", () => {
    const ex = extract({ title: "Puesto", descriptionText: "Texto breve." });
    expect(ex.seniority).toBeNull();
    expect(ex.employmentType).toBeNull();
    expect(ex.skillsRequired).toEqual([]);
    expect(ex.yearsRequired).toBeNull();
  });
});
