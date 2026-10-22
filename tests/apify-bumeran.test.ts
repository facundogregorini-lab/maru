import { describe, expect, it } from "vitest";
import { APIFY_JOBS, APIFY_KEYWORDS, APIFY_PRICE_PER_ROW, apifyJobInput, apifyNextCap, bumeranJobId, bumeranStateKey, normalizeApifyJobs } from "@/lib/match/apify";
import { analyzeStandalone } from "@/lib/match/inventory";
import { sourceById } from "@/lib/match/sources";

const now = "2026-10-22T20:00:00Z";
const description = "<p>¿Qué hace la compañía?</p><ul><li>Conciliaciones bancarias y análisis de cuentas.</li><li>Cierres mensuales.</li></ul><p>" + "Buscamos analista contable con experiencia en cierres, impuestos y reportes de gestión. ".repeat(6) + "</p>";
const url = "https://www.bumeran.com.ar/empleos/analista-contable-sr-empresa-sa-1118281573.html";
// Campos con los nombres reales del Actor blackfalcondata/bumeran-scraper (esquema y ejemplo de su README, 22/10/2026).
const row = {
  jobId: "8b5e8409ef8b0cd79b2344926756983a50df1d39430fce3f6ceb285029015206",
  jobKey: "1118281573",
  canonicalUrl: url,
  portalUrl: url,
  title: "Analista Contable Sr",
  company: "Empresa SA",
  companyLogo: "https://imgbum.jobscdn.com/portal/img/empresas/1/static/logoMainPic_2612300_bum_v71b9694.jpg",
  location: "Capital Federal, Buenos Aires",
  description,
  descriptionHtml: description,
  employmentType: "Full-time",
  contractType: "Indeterminado",
  workModality: "Híbrido",
  seniorityLevel: "Senior",
  jobArea: "Administración, Contabilidad y Finanzas",
  salaryText: null,
  salaryMin: null,
  salaryMax: null,
  postedDate: "2026-10-18T20:39:17",
  expiresDate: "2026-12-05",
  sourceCountry: "AR",
  sourceDomain: "www.bumeran.com.ar",
  isConfidential: false,
  changeType: "NEW",
  contactName: "Persona",
  contactEmail: "persona@example.com",
  extractedPhones: ["+54 11 5555-5555"],
};

describe("Bumeran vía Apify", () => {
  it("normaliza un aviso con id estable, descripción en texto, modalidad y atribución", () => {
    const { postings, accepted } = normalizeApifyJobs("bumeran", [row], now);
    expect(accepted).toBe(1);
    const [p] = postings;
    expect(p).toMatchObject({
      sourceId: "apify-bumeran", boardId: "apify:bumeran:ar", externalId: "1118281573", title: "Analista Contable Sr", company: "Empresa SA",
      sourceUrl: url, applyUrl: url, linkRequired: true, attribution: "Publicado en Bumeran · vía Apify", countries: ["AR"],
      locations: ["Capital Federal, Buenos Aires"], publishedAt: "2026-10-18T00:00:00.000Z", expiresAt: "2026-12-05T00:00:00.000Z",
      workplace: { value: "hibrido", from: "fuente" }, remoteFlag: null, department: "Administración, Contabilidad y Finanzas",
      employmentHint: "Full-time, Indeterminado", seniorityHint: "Senior", salary: null, companyLogo: row.companyLogo,
    });
    expect(p.descriptionText).toMatch(/¿Qué hace la compañía\?\n+• Conciliaciones bancarias/);
    expect(p.descriptionText).not.toContain("<");
    // Nunca se guardan contactos que el Actor pueda traer.
    expect(JSON.stringify(p)).not.toMatch(/Persona|persona@example\.com|5555/);
  });

  it("el id es el número del aviso: igual con o sin jobKey, y no depende del hash del Actor", () => {
    const sinKey = { ...row, jobKey: null, jobId: "otro-hash" };
    const numerico = { ...row, jobKey: 1118281573 };
    const ids = [row, sinKey, numerico].map((r) => normalizeApifyJobs("bumeran", [r], now).postings[0]?.externalId);
    expect(ids).toEqual(["1118281573", "1118281573", "1118281573"]);
    expect(bumeranJobId("https://www.bumeran.com.ar/empleos/node-js-software-engineer-remoto-1834-aliantec-1118281573.html?utm_source=x")).toBe("1118281573");
    expect(bumeranJobId("https://www.bumeran.com.pe/empleos/analista-1118281573.html")).toBe("");
    // Dos filas del mismo aviso en una corrida cuentan una sola vez.
    expect(normalizeApifyJobs("bumeran", [row, numerico], now).rejected).toEqual({ duplicado: 1 });
  });

  it("rechaza otro país, avisos viejos o vencidos, descripciones cortas y filas sin datos", () => {
    const rows = [
      row,
      { ...row, jobKey: "1118000001", canonicalUrl: "https://www.bumeran.com.pe/empleos/analista-contable-1118000001.html", portalUrl: null, sourceCountry: "PE" },
      { ...row, jobKey: "1118000002", canonicalUrl: "https://www.bumeran.com.ar/empleos/analista-1118000002.html", sourceCountry: "MX" },
      { ...row, jobKey: "1118000003", canonicalUrl: "https://www.bumeran.com.ar/empleos/analista-1118000003.html", postedDate: "2026-08-01T10:00:00" },
      { ...row, jobKey: "1118000004", canonicalUrl: "https://www.bumeran.com.ar/empleos/analista-1118000004.html", expiresDate: "2026-10-20" },
      { ...row, jobKey: "1118000005", canonicalUrl: "https://www.bumeran.com.ar/empleos/analista-1118000005.html", changeType: "EXPIRED" },
      { ...row, jobKey: "1118000006", canonicalUrl: "https://www.bumeran.com.ar/empleos/analista-1118000006.html", description: "<p>Breve</p>", descriptionHtml: "<p>Breve</p>" },
      { ...row, jobKey: "1118000007", canonicalUrl: "https://www.bumeran.com.ar/empleos/analista-1118000007.html", company: null },
      { ...row, jobKey: null, canonicalUrl: "https://www.bumeran.com.ar/empleos/analista.html", portalUrl: null },
    ];
    const result = normalizeApifyJobs("bumeran", rows, now);
    expect(result.accepted).toBe(1);
    expect(result.rejected).toEqual({ pais_no_confirmado: 2, vencido_o_antiguo: 3, descripcion_corta: 1, campos_obligatorios: 2 });
  });

  it("toma modalidad y salario sólo si la fuente los da", () => {
    const remoto = normalizeApifyJobs("bumeran", [{ ...row, workModality: "Remoto", salaryText: "$ 1.500.000 - $ 1.800.000", salaryCurrency: "ARS", salaryMin: 1500000, salaryMax: 1800000 }], now).postings[0];
    expect(remoto.workplace).toMatchObject({ value: "remoto", from: "fuente" });
    expect(remoto.remoteFlag).toBe(true);
    expect(remoto.salary?.value).toMatchObject({ min: 1500000, max: 1800000, currency: "ARS", text: "$ 1.500.000 - $ 1.800.000" });
    const presencial = normalizeApifyJobs("bumeran", [{ ...row, workModality: "Presencial", salaryMin: 0 }], now).postings[0];
    expect(presencial.workplace.value).toBe("presencial");
    expect(presencial.remoteFlag).toBe(false);
    expect(presencial.salary).toBeNull();
    const sinDato = normalizeApifyJobs("bumeran", [{ ...row, workModality: null }], now).postings[0];
    expect(sinDato.workplace.value).toBe("desconocido");
    expect(analyzeStandalone(sinDato, now).eligibility.status).not.toBe("no_elegible");
  });

  it("arma la búsqueda: Argentina, más recientes, descripción completa y modo incremental por palabra", () => {
    const input = apifyJobInput("bumeran", "analista contable", 100, 500, "curious", "month");
    expect(input).toEqual({
      query: "analista contable", country: "AR", sort: "RECIENTES", maxResults: 100,
      includeDetails: true, descriptionFormat: "html", descriptionMaxLength: 0, compact: false,
      incrementalMode: true, stateKey: "maru-ar-analista-contable", emitUnchanged: false, emitExpired: false,
    });
    expect(bumeranStateKey("Jóvenes Profesionales")).toBe("maru-ar-jovenes-profesionales");
    expect(() => apifyJobInput("bumeran", "analista", 100, 500, "curious", "week", "Latin America")).toThrow(/Argentina/);
    expect(() => apifyJobInput("bumeran", "analista", 100, 500, "valig", "week", "Argentina", { skipJobIds: ["1"] })).toThrow();
    expect(() => apifyJobInput("bumeran", "analista", 501, 500)).toThrow();
  });

  it("precio, palabras por defecto y registro de la fuente", () => {
    expect(APIFY_PRICE_PER_ROW.bumeran).toBe(0.001);
    // 100 filas: inicio estimado US$0,02 + 100 × 0,001.
    expect(apifyNextCap("bumeran", 100, 0, 1)).toBeCloseTo(0.12);
    expect(apifyNextCap("bumeran", 100, 0.95, 1)).toBe(0);
    expect(APIFY_KEYWORDS.bumeran.length).toBeGreaterThanOrEqual(35);
    expect(new Set(APIFY_KEYWORDS.bumeran).size).toBe(APIFY_KEYWORDS.bumeran.length);
    expect(APIFY_JOBS.bumeran.fields).not.toEqual(expect.arrayContaining(["contactEmail"]));
    expect(APIFY_JOBS.bumeran.fields.some((f) => /contact|extracted|social/i.test(f))).toBe(false);
    expect(sourceById("apify-bumeran")).toMatchObject({ imported: true, staleDays: 30, cost: "pago", linkRequired: true });
  });
});
