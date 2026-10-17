import { afterEach, describe, expect, it, vi } from "vitest";
import { apifyNextCap } from "@/lib/match/apify";
import { applyBoard, buildOpportunities, emptyInventory, expireImported, purge, refreshImported } from "@/lib/match/inventory";
import { workplaceFromDescription } from "@/lib/match/connectors";
import { isInferred } from "@/lib/match/labels";
import { FANTASTIC_COHORTS, MONTHLY_QUERY_PREFIXES, normalizeFantastic, normalizeSerp, pickApplyLink, relativeAgeDays, runFantastic, runSerp, SERP_QUERIES } from "@/lib/match/providers";

const NOW = "2026-10-17T12:00:00.000Z";
const T = Date.parse(NOW);
const description = "Buscamos analista administrativo contable para liquidación de impuestos, conciliaciones bancarias y facturación. ".repeat(5);
const fantasticRow = {
  id: "2416629355",
  title: "Analista Jr. de Cobranzas y Cuentas Corrientes",
  organization: "Swiss Medical Group",
  organization_logo: "https://media.example.com/logo.png",
  url: "https://swissmedical.jobs2web.com/job/Capital-Federal-Analista/1440664600/",
  date_posted: "2026-10-15T00:00:00",
  date_valid_through: "2027-10-16T03:00:00",
  locations_derived: ["Buenos Aires, Argentina"],
  countries_derived: ["Argentina"],
  remote_derived: false,
  employment_type: ["FULL_TIME"],
  description_text: description,
  source: "successfactors",
  recruiter_name: "PERSONA PRIVADA",
};
const serpRow = {
  title: "Administrativo/a contable",
  company_name: "Distribuidora del Centro",
  location: "Córdoba, Argentina",
  via: "LinkedIn",
  thumbnail: "https://encrypted-tbn0.gstatic.com/images?q=x",
  description,
  detected_extensions: { posted_at: "hace 3 días", schedule_type: "Tiempo completo" },
  apply_options: [
    { title: "Talent.com", link: "https://ar.talent.com/view?id=1" },
    { title: "LinkedIn", link: "https://ar.linkedin.com/jobs/view/123" },
    { title: "Distribuidora del Centro", link: "https://empleos.distribuidora.com.ar/avisos/42?utm_source=google" },
  ],
};
const json = (body: unknown, headers?: Record<string, string>) => new Response(JSON.stringify(body), { headers });

afterEach(() => vi.unstubAllGlobals());

describe("Fantastic.jobs → aviso normalizado", () => {
  it("conserva enlace del empleador, fechas tal cual, logo y país; no copia datos de reclutadores", () => {
    const { postings, rejected } = normalizeFantastic([fantasticRow], "fantastic_ats", "G1", T);
    expect(rejected).toEqual({});
    const p = postings[0];
    expect(p).toMatchObject({ sourceId: "fantastic_ats", boardId: "fantastic:ats:ar", externalId: "2416629355", applyUrl: fantasticRow.url, countries: ["AR"], publishedAt: "2026-10-15T00:00:00", expiresAt: "2027-10-16T03:00:00", companyLogo: fantasticRow.organization_logo, linkRequired: false });
    expect(p.employmentHint).toBe("full time");
    expect(JSON.stringify(p)).not.toContain("PERSONA PRIVADA");
  });
  it("LinkedIn exige su enlace; rechaza vencidos, viejos, cortos, incompletos y repetidos", () => {
    const rows = [
      fantasticRow,
      fantasticRow,
      { ...fantasticRow, id: "2", date_valid_through: "2026-10-01T00:00:00" },
      { ...fantasticRow, id: "3", date_posted: "2026-07-01T00:00:00" },
      { ...fantasticRow, id: "4", description_text: "corta" },
      { ...fantasticRow, id: "5", url: "javascript:alert(1)" },
      { ...fantasticRow, id: "6", organization_logo: "http://inseguro.example.com/logo.png" },
    ];
    const { postings, rejected } = normalizeFantastic(rows, "fantastic_jb", "G1", T);
    expect(postings.map((p) => p.externalId)).toEqual(["2416629355", "6"]);
    expect(postings[0].linkRequired).toBe(true);
    expect(postings[1].companyLogo).toBeUndefined();
    expect(rejected).toEqual({ repetido_en_la_respuesta: 1, vencido: 1, antiguo: 1, descripcion_corta: 1, faltan_campos: 1 });
  });
  it("las cohortes cubren generalistas y tecnología", () => {
    expect(FANTASTIC_COHORTS.map((c) => c.id)).toEqual(["G1", "G2", "G3", "G4", "T1"]);
  });
});

describe("Google Jobs (SerpApi) → aviso normalizado", () => {
  it("prefiere el sitio del empleador, limpia utm y no inventa fecha exacta", () => {
    expect(pickApplyLink(serpRow.apply_options)!.url).toBe("https://empleos.distribuidora.com.ar/avisos/42");
    const { postings } = normalizeSerp([serpRow], "administrativo contable Córdoba", T);
    expect(postings[0]).toMatchObject({ sourceId: "serpapi", publishedAt: null, postedLabel: "hace 3 días", countries: ["AR"], descriptionComplete: false, linkRequired: true });
    expect(postings[0].attribution).toContain("Google Jobs");
  });
  it("la misma vacante en dos búsquedas tiene el mismo id; descarta sólo-agregadores y antiguos", () => {
    const a = normalizeSerp([serpRow], "q1", T).postings[0];
    const b = normalizeSerp([serpRow], "q2", T).postings[0];
    expect(a.externalId).toBe(b.externalId);
    const { postings, rejected } = normalizeSerp(
      [
        { ...serpRow, apply_options: [{ title: "Jooble", link: "https://ar.jooble.org/desc/1" }] },
        { ...serpRow, detected_extensions: { posted_at: "hace 2 meses" } },
      ],
      "q",
      T,
    );
    expect(postings).toHaveLength(0);
    expect(rejected).toEqual({ solo_agregadores: 1, antiguo: 1 });
  });
  it("lee antigüedades relativas en español e inglés", () => {
    expect(relativeAgeDays("hace 3 días")).toBe(3);
    expect(relativeAgeDays("2 weeks ago")).toBe(14);
    expect(relativeAgeDays("hace 1 mes")).toBe(30);
    expect(relativeAgeDays("Tiempo completo")).toBeNull();
  });
});

describe("saldo: nunca más de lo incluido", () => {
  const quota = (jobs: number, requests: number, used = 0) => ({ "x-api-jobs-remaining": String(jobs), "x-api-requests-remaining": String(requests), "x-api-jobs-this-request": String(used) });

  it("Fantastic no descarga si el proveedor no informa saldo", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ count: 10 }));
    vi.stubGlobal("fetch", fetcher);
    const out = await runFantastic("secret-key", { cohorts: ["G1"], feeds: ["fantastic_ats"], limit: 50, maxJobs: 100, timeFrame: "7d" }, undefined, NOW);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(out.batches).toHaveLength(0);
    expect(out.stopped).toMatch(/saldo/);
  });

  it("Fantastic ajusta el límite al saldo y al tope de la corrida, sin reintentar errores ni registrar la clave", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ count: 500 }, quota(30, 10)))
      .mockResolvedValueOnce(json([fantasticRow], quota(29, 9, 1)))
      .mockResolvedValueOnce(new Response("secret-key", { status: 500 }));
    vi.stubGlobal("fetch", fetcher);
    const out = await runFantastic("secret-key", { cohorts: ["G1", "G2"], feeds: ["fantastic_ats", "fantastic_jb"], limit: 50, maxJobs: 40, timeFrame: "7d" }, undefined, NOW);
    const firstData = fetcher.mock.calls[1][0] as URL;
    expect(firstData.searchParams.get("limit")).toBe("30");
    const second = fetcher.mock.calls[2][0] as URL;
    expect(second.pathname).toBe("/v1/active-jb");
    expect(second.searchParams.get("limit")).toBe("29");
    expect(second.searchParams.get("exclude_recruiter_fields")).toBe("true");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(out.batches[0].postings).toHaveLength(1);
    expect(out.employers[0]).toMatchObject({ company: "Swiss Medical Group", ats: "successfactors" });
    expect(out.stopped).toMatch(/Sin reintentos/);
    expect(JSON.stringify(out)).not.toContain("secret-key");
  });

  it("Fantastic no confía en un saldo cacheado: descuenta lo ya consumido", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ count: 500 }, quota(50, 10)))
      .mockImplementation(async () => json([fantasticRow], quota(50, 10, 30)));
    vi.stubGlobal("fetch", fetcher);
    await runFantastic("k", { cohorts: ["G1", "G2"], feeds: ["fantastic_ats"], limit: 40, maxJobs: 500, timeFrame: "7d" }, undefined, NOW);
    expect((fetcher.mock.calls[1][0] as URL).searchParams.get("limit")).toBe("40");
    expect((fetcher.mock.calls[2][0] as URL).searchParams.get("limit")).toBe("20"); // 50 − 30, aunque el header repita 50
  });

  it("Fantastic pide la página siguiente con offset para no pagar repetidos", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ count: 500 }, quota(50, 10)))
      .mockImplementation(async () => json([fantasticRow], quota(49, 9, 1)));
    vi.stubGlobal("fetch", fetcher);
    await runFantastic("k", { cohorts: ["G3"], feeds: ["fantastic_ats"], limit: 20, maxJobs: 50, timeFrame: "7d", offset: 45 }, undefined, NOW);
    expect((fetcher.mock.calls[1][0] as URL).searchParams.get("offset")).toBe("45");
  });

  it("SerpApi usa sólo búsquedas del plan menos la reserva y no guarda la clave", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ plan_name: "Free", plan_searches_left: 22, total_searches_left: 5000, api_key: "secret-serp" }))
      .mockImplementation(async () => json({ jobs_results: [serpRow] }));
    vi.stubGlobal("fetch", fetcher);
    const out = await runSerp("secret-serp", { queries: SERP_QUERIES, maxSearches: 12, reserve: 20 }, undefined, NOW);
    expect(fetcher).toHaveBeenCalledTimes(3); // cuenta + 2 búsquedas (22 − 20)
    expect(out.batches).toHaveLength(2);
    expect(JSON.stringify(out.ledger)).not.toContain("secret-serp");
  });

  it("SerpApi saltea una búsqueda sin respuesta y frena con dos seguidas", async () => {
    const timeout = async () => { throw new Error("aborted"); };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ plan_name: "Free", plan_searches_left: 30 }))
      .mockImplementationOnce(timeout)
      .mockImplementationOnce(async () => json({ jobs_results: [serpRow] }))
      .mockImplementationOnce(timeout)
      .mockImplementationOnce(timeout)
      .mockImplementation(async () => json({ jobs_results: [serpRow] }));
    vi.stubGlobal("fetch", fetcher);
    const out = await runSerp("k", { queries: SERP_QUERIES, maxSearches: 8, reserve: 20 }, undefined, NOW);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(out.batches).toHaveLength(1);
    expect(out.ledger.filter((l) => l.error)).toHaveLength(3);
    expect(out.stopped).toContain("no respondió a tiempo");
  });

  it("Apify frena antes de pasarse del presupuesto acumulado", () => {
    expect(apifyNextCap("linkedin", 100, 0, 5)).toBeCloseTo(0.22);
    expect(apifyNextCap("linkedin", 100, 4.9, 5)).toBe(0);
    expect(apifyNextCap("indeed", 100, 4.9, 5)).toBeCloseTo(0.03);
  });
});

describe("inventario con importaciones parciales", () => {
  it("una ausencia no cierra; la sync diaria no los purga y los vence por fecha o por no volver a verlos", () => {
    const inv = emptyInventory("fixture");
    const batch = normalizeFantastic([fantasticRow, { ...fantasticRow, id: "9", date_valid_through: "2026-10-20T00:00:00" }], "fantastic_ats", "G1", T);
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings: batch.postings, complete: false }, NOW);
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings: [], complete: false }, "2026-10-18T12:00:00.000Z");
    expect(inv.postings.every((p) => p.status === "abierta")).toBe(true);
    // La sync diaria purga bolsas fuera del directorio, pero no las importadas.
    purge(inv, "2026-10-18T12:00:00.000Z", new Set(["greenhouse:acme"]));
    expect(inv.postings).toHaveLength(2);
    expect(expireImported(inv, "2026-10-21T12:00:00.000Z")).toBe(1);
    expect(inv.postings.find((p) => p.externalId === "9")!.closedReason).toBe("Venció según la fuente");
    expect(expireImported(inv, "2026-11-20T12:00:00.000Z")).toBe(1);
    inv.opportunities = buildOpportunities(inv.postings);
    expect(inv.opportunities.every((o) => o.status === "cerrada")).toBe(true);
  });
  it("la modalidad sale del texto sólo si está declarada, y los importados se re-analizan sin volver a descargarlos", () => {
    expect(workplaceFromDescription("Modalidad de trabajo: Presencial en Retiro.")?.value).toBe("presencial");
    expect(workplaceFromDescription("Modalidad híbrida de trabajo, 3 días en oficina.")?.value).toBe("hibrido");
    expect(workplaceFromDescription("Equipo bajo modalidad 100% home office.")?.value).toBe("remoto");
    expect(workplaceFromDescription("Beneficios: home office los viernes, prepaga.")).toBeNull();
    expect(workplaceFromDescription("Esquema de empleo híbrido: 3 días presenciales y 2 días home office.")?.value).toBe("hibrido");
    expect(workplaceFromDescription("Lunes a viernes de 9 a 18. 2 días home office.")?.value).toBe("hibrido");
    expect(workplaceFromDescription("You'll be 3 days per week on-site in Buenos Aires.")?.value).toBe("hibrido");
    expect(workplaceFromDescription("Jornada full-time presencial de lunes a viernes.")?.value).toBe("presencial");
    expect(workplaceFromDescription("Trabajo de 5 días presenciales en planta.")?.value).toBe("presencial");
    expect(workplaceFromDescription("El trabajo será de forma presencial en Pilar.")?.value).toBe("presencial");
    expect(workplaceFromDescription("Modalidad part time presencial, lunes a viernes.")?.value).toBe("presencial");
    expect(workplaceFromDescription("Go and Elixir are a plus. #LI-JB1 #LI-Remote")?.value).toBe("remoto");
    expect(workplaceFromDescription("What we offer: remote full-time position with flexible hours.")?.value).toBe("remoto");
    expect(workplaceFromDescription("This role is categorized as hybrid.")?.value).toBe("hibrido");
    expect(workplaceFromDescription("Our Palermo office with a mandatory in-office presence four days per week.")?.value).toBe("hibrido");
    expect(workplaceFromDescription("Lugar de trabajo: Saavedra, CABA.")).toBeNull();
    expect(workplaceFromDescription("This role is a full-time remote position.")?.value).toBe("remoto");
    expect(workplaceFromDescription("Monitoreo remoto de cámaras y control de accesos.")).toBeNull();
    const inv = emptyInventory("fixture");
    const [p] = normalizeFantastic([{ ...fantasticRow, remote_derived: undefined }], "fantastic_ats", "G1", T).postings;
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings: [p], complete: false }, NOW);
    expect(inv.postings[0].workplace.value).toBe("desconocido");
    inv.postings[0].descriptionText += " Modalidad: presencial en Córdoba.";
    expect(refreshImported(inv)).toBe(1);
    expect(inv.postings[0].workplace).toMatchObject({ value: "presencial", from: "descripcion" });
    expect(refreshImported(inv)).toBe(0);
  });

  it("en portales locales, ciudad sin mención de remoto es presencial inferido (y se marca así)", () => {
    const serp = (patch: Record<string, unknown>) => {
      const inv = emptyInventory("fixture");
      applyBoard(inv, "serpapi:ar", "serpapi", { postings: normalizeSerp([{ ...serpRow, ...patch }], "q", T).postings, complete: false }, NOW);
      return inv.postings[0].workplace;
    };
    const w = serp({});
    expect(w).toMatchObject({ value: "presencial", from: "descripcion" });
    expect(isInferred(w)).toBe(true);
    expect(w.evidence).toMatch(/Córdoba/);
    // Si el texto habla de remoto o híbrido, o no hay una ciudad, no se adivina.
    expect(serp({ description: `${description} Posibilidad de home office.` }).value).toBe("desconocido");
    expect(serp({ location: "Argentina" }).value).toBe("desconocido");
    // "Desde casa" como ubicación es la modalidad: remoto.
    expect(serp({ location: "Desde casa" })).toMatchObject({ value: "remoto", from: "fuente" });
    // Lo que el aviso declara no se marca como inferido.
    expect(isInferred(serp({ description: `${description} Modalidad: presencial.` }))).toBe(false);
  });

  it("el aviso importado es elegible si la fuente informa Argentina", () => {
    const inv = emptyInventory("fixture");
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings: normalizeFantastic([fantasticRow], "fantastic_ats", "G1", T).postings, complete: false }, NOW);
    expect(inv.postings[0].eligibility.status).toBe("elegible");
    expect(inv.postings[0].extracted.family.value).not.toBe("software");
  });
});

describe("tanda automática de marketing y finanzas", () => {
  it("tiene búsquedas de marketing y de finanzas con ids únicos", () => {
    const monthly = SERP_QUERIES.filter((q) => MONTHLY_QUERY_PREFIXES.some((p) => q.id.startsWith(p)));
    expect(monthly.filter((q) => q.id.startsWith("mk-")).length).toBeGreaterThanOrEqual(10);
    expect(monthly.filter((q) => q.id.startsWith("fz-")).length).toBeGreaterThanOrEqual(10);
    expect(monthly.filter((q) => q.id.startsWith("tj-")).length).toBeGreaterThanOrEqual(5);
    expect(monthly.length).toBeLessThanOrEqual(36); // entra en una corrida de --max-searches=36
    expect(new Set(SERP_QUERIES.map((q) => q.id)).size).toBe(SERP_QUERIES.length);
  });
});
