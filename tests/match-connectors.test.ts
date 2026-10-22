import { describe, expect, it } from "vitest";
import {
  fetchAshby,
  normalizeGetonbrd,
  fetchGetonbrd,
  fetchGreenhouse,
  fetchJobicy,
  fetchLever,
  fetchRemotive,
  gobApplicantCountries,
  parseBoardUrl,
} from "@/lib/match/connectors";
import { classifyEligibility } from "@/lib/match/eligibility";
import { applyBoard, emptyInventory } from "@/lib/match/inventory";
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

  it("Get on Board: países de un remoto según la página del aviso", () => {
    const country = (n: string) => `<span itemprop="applicantLocationRequirements" itemscope itemtype="http://schema.org/Country"> <meta content="${n}" itemprop="name"> </span>`;
    expect(gobApplicantCountries(["Chile", "Argentina", "Falkland Islands (Malvinas)", "Brasil"].map(country).join(""))).toEqual(["CL", "AR", "BR"]);
    expect(gobApplicantCountries(["Colombia", "Mexico", "Costa Rica"].map(country).join(""))).not.toContain("AR");
    expect(gobApplicantCountries("<h1>Sin datos</h1>")).toEqual([]);
  });

  it("Get on Board: conserva los países ya leídos de la página cuando la sync no la vuelve a leer", () => {
    const base = normalizeGetonbrd(fixture<{ jobs: { data: Parameters<typeof normalizeGetonbrd>[0][] } }>("getonbrd.json").jobs.data[0], BOARDS.getonbrd);
    const remote = { ...base, workplace: { value: "remoto" as const, from: "fuente" as const }, countries: [] as string[] };
    const inv = emptyInventory("fixture");
    applyBoard(inv, base.boardId, "getonbrd", { postings: [{ ...remote, countries: ["AR", "CL"] }], complete: true }, "2026-10-22T00:00:00.000Z");
    applyBoard(inv, base.boardId, "getonbrd", { postings: [remote], complete: true }, "2026-10-23T00:00:00.000Z");
    expect(inv.postings[0].countries).toEqual(["AR", "CL"]);
    expect(inv.postings[0].eligibility.status).toBe("elegible");
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
  it("ciudades argentinas homónimas en EE. UU. no cuentan como Argentina", () => {
    for (const l of ["Martinez, CA", "San Juan, TX", "Cordoba, Spain"]) {
      expect(classifyEligibility(posting({ locations: [l] })).status).not.toBe("elegible");
    }
    expect(classifyEligibility(posting({ locations: ["Martínez, Buenos Aires"] })).status).toBe("elegible");
    expect(classifyEligibility(posting({ locations: ["Córdoba, Argentina", "London, UK"] })).status).toBe("elegible");
  });
  it("una ciudad de nombre repetido no alcanza si la fuente informa otro país donde existe o el título lo nombra", () => {
    expect(classifyEligibility(posting({ locations: ["Cordoba"], countries: ["ES"] })).status).not.toBe("elegible");
    expect(classifyEligibility({ ...posting({ locations: ["Cordoba"] }), title: "Driver / Data Collector in Cordoba, Spain" }).status).not.toBe("elegible");
    // Lever informa sólo el país de la primera sede: Buenos Aires en la lista sigue valiendo.
    expect(classifyEligibility(posting({ locations: ["Madrid", "Buenos Aires"], countries: ["ES"] })).status).toBe("elegible");
    expect(classifyEligibility(posting({ locations: ["Cordoba", "Medellin"], countries: ["BR"] })).status).toBe("elegible");
  });
  it("reconoce provincias del interior y ciudades del exterior que antes quedaban sin confirmar", () => {
    for (const l of ["Resistencia, Chaco", "San Luis", "Comodoro Rivadavia, Chubut", "Santiago del Estero"]) {
      expect(classifyEligibility(posting({ locations: [l] })).status).toBe("elegible");
    }
    for (const l of ["Auckland", "Athens, Greece", "Budapest", "Remote (Taiwan)"]) {
      expect(classifyEligibility(posting({ locations: [l] })).status).toBe("no_elegible");
    }
  });
  it("un link con %-escape inválido no rompe el parser", () => {
    expect(parseBoardUrl("https://jobs.lever.co/%E0%A4")).toBeNull();
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
  it("remoto sin región: la descripción que ata la residencia a LATAM o a cualquier lugar lo habilita", () => {
    const ok = [
      "Fully remote position open to candidates across Latin America.",
      "Location: Remote Latin America. Contractor engagement.",
      "Based in Latin America with 6 hours of overlap with US Pacific time.",
      "100% remoto desde cualquier país de Latinoamérica. Pago en USD.",
      "Debes residir actualmente en Chile, Argentina o Perú.",
      "Esta posición está abierta para todo LATAM.",
      "Fully remote: we hire globally.",
    ];
    for (const d of ok) expect(classifyEligibility(posting({ locations: ["Remote"], workplace: remote, descriptionText: d })).status, d).toBe("elegible");
    const unclear = [
      "Trabajarás con clientes de LATAM y Norteamérica.",
      "Se valorará experiencia previa en LATAM Airlines.",
      "Títulos de universidades de Chile o de cualquier parte del mundo.",
      "This role can be based anywhere in North Dakota.",
    ];
    for (const d of unclear) expect(classifyEligibility(posting({ locations: ["Remote"], workplace: remote, descriptionText: d })).status, d).toBe("por_confirmar");
  });
  it("remoto sin región: el título que dice 'Worldwide' lo habilita; 'Global' a secas no", () => {
    const e = classifyEligibility(posting({ title: "Senior Node.js Software Engineer - Holepunch (100% Remote, Worldwide)", locations: ["Remote job"], workplace: remote }));
    expect(e.status).toBe("elegible");
    expect(e.evidence[0]).toMatch(/El título dice/);
    expect(classifyEligibility(posting({ title: "Head of Global Events and Travel (100% REMOTE)", locations: ["Remote job"], workplace: remote })).status).toBe("por_confirmar");
  });
  it("remoto sin región: pedir residencia en otro país lo descarta", () => {
    for (const d of ["100% remote position for candidates located in Colombia.", "Residencia en Ciudad de México requerida.", "Candidates must be currently based and authorized to work in Mexico."]) {
      expect(classifyEligibility(posting({ locations: ["Remote"], workplace: remote, descriptionText: d })).status, d).toBe("no_elegible");
    }
    expect(classifyEligibility(posting({ locations: ["Remote"], workplace: remote, descriptionText: "Debes residir en Santiago del Estero." })).status).not.toBe("no_elegible");
  });
  it("un remoto atado a un estado o región de otro país no es elegible", () => {
    for (const l of ["New South Wales", "Saskatchewan", "Texas", "Remote - North America", "Victoria"]) {
      expect(classifyEligibility(posting({ locations: [l], workplace: remote })).status, l).toBe("no_elegible");
    }
    expect(classifyEligibility(posting({ locations: ["Victoria, Entre Ríos"], workplace: remote })).status).toBe("elegible");
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

describe("Get on Board: remoto sin país", () => {
  const board = { sourceId: "getonbrd" as const, boardId: "getonbrd" };
  const job = (modality: string, countries: string[] = [], description = "<p>Buscamos Growth Marketer para campañas y email.</p>") =>
    normalizeGetonbrd({ id: "growth-1", attributes: { title: "Growth Marketer", description, remote_modality: modality, countries, company: { data: { attributes: { name: "Acme" } } } } }, board);

  it("fully_remote sin países es remoto global y queda elegible", () => {
    const p = job("fully_remote");
    expect(p.remoteGlobal).toBe(true);
    const e = classifyEligibility(p);
    expect(e.status).toBe("elegible");
    expect(e.evidence[0]).toMatch(/sin restricción de país/);
  });

  it("remote_local, o una descripción que pide vivir en otro país, no", () => {
    expect(job("remote_local").remoteGlobal).toBeUndefined();
    expect(classifyEligibility(job("remote_local")).status).toBe("por_confirmar");
    expect(classifyEligibility(job("fully_remote", [], "<p>Candidates must be based in Mexico.</p>")).status).toBe("no_elegible");
  });
});
