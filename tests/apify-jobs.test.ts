import { describe, expect, it } from "vitest";
import { LINKEDIN_CITIES, apifyJobInput, apifyNextCap, apifyRepeatReason, apifySourceOfActor, knownLinkedinIds, normalizeApifyJobs } from "@/lib/match/apify";
import { analyzeStandalone, applyBoard, emptyInventory, refreshImported } from "@/lib/match/inventory";
import { canonicalUrl } from "@/lib/match/text";
const now = "2026-10-16T20:00:00Z";
const description = "Buscamos analista para preparar reportes de ventas con SQL y tableros. ".repeat(8);
const indeed = { id: "job-1", title: "Analista", "companyDetails.name": "Empresa", viewJobLink: "/viewjob?jk=job-1", formattedLocation: "Buenos Aires", "location.countryCode": "AR", jobDescription: description, pubDate: 1792071870004 };

describe("piloto de avisos Apify", () => {
  it("normaliza enlaces relativos y conserva identidad en queries sin unir avisos distintos", () => {
    const { postings } = normalizeApifyJobs("indeed", [indeed, { ...indeed, id: "job-2", viewJobLink: "/viewjob?jk=job-2" }], now);
    expect(postings).toHaveLength(2);
    expect(postings[0].sourceUrl).toBe("https://ar.indeed.com/viewjob?jk=job-1");
    expect(canonicalUrl(postings[0].sourceUrl)).not.toBe(canonicalUrl(postings[1].sourceUrl));
    expect(canonicalUrl("https://candidato.ar.computrabajo.com/candidate/apply/?oi=123&p=4")).toBe("computrabajo-job:123");
  });
  it("rechaza datos sin empresa, extractos cortos, vencidos y país sin confirmar", () => {
    const result = normalizeApifyJobs("indeed", [indeed, { ...indeed, expired: true }, { ...indeed, "companyDetails.name": "" }, { ...indeed, jobDescription: "Breve" }, { ...indeed, "location.countryCode": "US" }, { ...indeed, id: "otro", pubDate: 1600000000000 }], now);
    expect(result.accepted).toBe(1);
    expect(result.rejected).toEqual({ vencido_o_antiguo: 2, campos_obligatorios: 1, descripcion_corta: 1, pais_no_confirmado: 1 });
  });
  it("no trae atributos personales y no inventa modalidad ni salario", () => {
    const row = { id: "123", title: "Analista", company: "Empresa", url: "https://ar.computrabajo.com/oferta/123", location: "Córdoba", descriptionText: description, salary: "A convenir", ageMin: 22, jobPosterName: "Persona" };
    const p = normalizeApifyJobs("computrabajo", [row], now).postings[0];
    expect(p.salary).toBeNull();
    expect(p.workplace.value).toBe("desconocido");
    expect(JSON.stringify(p)).not.toContain("Persona");
    expect(p).not.toHaveProperty("ageMin");
  });
  it("guarda el logo de la empresa sólo si es https", () => {
    const row = { id: "9", title: "Analista", company: "Empresa", url: "https://ar.computrabajo.com/oferta/9", location: "Córdoba", descriptionText: description };
    expect(normalizeApifyJobs("computrabajo", [{ ...row, companyLogo: "https://img.example.com/logo.png" }], now).postings[0].companyLogo).toBe("https://img.example.com/logo.png");
    expect(normalizeApifyJobs("computrabajo", [{ ...row, logo: "http://img.example.com/logo.png" }], now).postings[0]).not.toHaveProperty("companyLogo");
  });
  it("los Actors alternativos de LinkedIn dan el mismo id que el actual, sin datos de quien publica", () => {
    const link = "https://ar.linkedin.com/jobs/view/analista-de-datos-at-empresa-4476654521?refId=abc&trackingId=x";
    const curious = { id: "4476654521", title: "Analista de datos", companyName: "Empresa", link, location: "Buenos Aires, Argentina", descriptionText: description };
    const alt = { jobId: 99, jobTitle: "Analista de datos", company: { name: "Empresa" }, jobUrl: "https://www.linkedin.com/jobs/view/4476654521/", location: "Buenos Aires, Argentina", jobDescription: `<p>${description}</p>`, publishedAt: "2026-10-15", experienceLevel: "Entry level", contractType: "Full-time", posterFullName: "Persona" };
    const [a] = normalizeApifyJobs("linkedin", [curious], now).postings;
    const [b] = normalizeApifyJobs("linkedin", [alt], now).postings;
    expect(a.externalId).toBe("4476654521");
    expect(b).toMatchObject({ externalId: "4476654521", title: "Analista de datos", company: "Empresa", seniorityHint: "Entry level", employmentHint: "Full-time" });
    expect(JSON.stringify(b)).not.toContain("Persona");
  });
  it("prefiere la descripción en HTML para conservar párrafos y listas (valig trae el texto plano pegado)", () => {
    const row = { id: "4480846130", title: "Consultor SAP", companyName: "Empresa", url: "https://ar.linkedin.com/jobs/view/consultor-sap-at-empresa-4480846130", location: "Buenos Aires, Argentina", description: `Qué buscamos?Experiencia en SAP.${description}`, descriptionHtml: `<p>Qué buscamos?</p><ul><li>Experiencia en SAP</li></ul><p>${description}</p>` };
    const [p] = normalizeApifyJobs("linkedin", [row], now).postings;
    expect(p.descriptionText).toMatch(/Qué buscamos\?\n+• Experiencia en SAP/);
  });
  it("valig: workType es el rubro de la empresa, no se usa como área (y se borra lo guardado)", () => {
    const base = { title: "Specialist", companyName: "Empresa", location: "Buenos Aires, Argentina", descriptionHtml: `<p>${description}</p>` };
    const [p] = normalizeApifyJobs("linkedin", [{ ...base, url: "https://ar.linkedin.com/jobs/view/x-4480846131", workType: "Financial Services" }], now).postings;
    expect(p.department).toBeUndefined();
    const inv = emptyInventory("fixture");
    applyBoard(inv, "apify:linkedin:ar", "apify-linkedin", { postings: [{ ...p, department: "Financial Services" }], complete: false }, now);
    expect(inv.postings[0].extracted.family).toMatchObject({ value: "finanzas", from: "fuente" });
    expect(refreshImported(inv)).toBe(1);
    expect(inv.postings[0].department).toBeUndefined();
    expect(inv.postings[0].extracted.family.value).toBe("otros");
  });
  it("acepta puestos de LinkedIn para Latinoamérica sin fijar Argentina: decide la elegibilidad", () => {
    const base = { title: "Senior Data Engineer", companyName: "Empresa", location: "Latin America", descriptionHtml: `<p>${description}</p>` };
    const rows = [
      { ...base, id: "4480000001", url: "https://www.linkedin.com/jobs/view/4480000001/" },
      { ...base, id: "4480000002", url: "https://www.linkedin.com/jobs/view/4480000002/", descriptionHtml: `<p>${description} Candidates must reside in the United States.</p>` },
      { ...base, id: "4480000003", url: "https://www.linkedin.com/jobs/view/4480000003/", location: "Mexico City, Mexico" },
    ];
    const { postings, rejected } = normalizeApifyJobs("linkedin", rows, now);
    expect(rejected).toEqual({ pais_no_confirmado: 1 });
    expect(postings.map((p) => p.countries)).toEqual([[], []]);
    const [ok, usOnly] = postings.map((p) => analyzeStandalone(p, now).eligibility.status);
    expect(ok).toBe("elegible");
    expect(usOnly).not.toBe("elegible");
    expect(apifyJobInput("linkedin", "data engineer", 100, 500, "valig", "month", "Latin America")).toMatchObject({ location: "Latin America" });
    expect(apifyJobInput("linkedin", "analista", 100, 500, "valig", "week", LINKEDIN_CITIES.cordoba)).toMatchObject({ location: "Córdoba, Argentina" });
    // La misma palabra en otra ciudad es otra búsqueda: no la frena la regla de 7 días.
    const log = [{ at: "2026-10-23T10:00:00Z", provider: "apify", call: "run", params: { actor: "valig/linkedin-jobs-scraper", keyword: "analista", location: "Argentina" }, rows: 100 }];
    expect(apifyRepeatReason(log as never, "valig/linkedin-jobs-scraper", "analista", LINKEDIN_CITIES.cordoba, false, "2026-10-24T10:00:00Z")).toBeNull();
    expect(apifyRepeatReason(log as never, "valig/linkedin-jobs-scraper", "analista", "Argentina", false, "2026-10-24T10:00:00Z")).not.toBeNull();
  });
  it("arma la entrada de cada Actor de LinkedIn y calcula el tope con su precio", () => {
    expect(apifyJobInput("linkedin", "data analyst", 200, 500, "valig")).toMatchObject({ keywords: "data analyst", location: "Argentina", limit: 200, titleExclude: expect.arrayContaining(["chofer"]) });
    expect(apifyJobInput("linkedin", "data analyst", 200, 500, "cheap")).toMatchObject({ keyword: ["data analyst"], maxItems: 200, saveOnlyUniqueItems: true, jobTitleExclude: expect.arrayContaining(["operario"]) });
    expect(apifyJobInput("linkedin", "seo", 100, 500, "valig", "month")).toMatchObject({ datePosted: "r2592000" });
    expect(apifyNextCap("linkedin", 500, 0, 5, "valig")).toBeCloseTo(0.22);
    expect(apifyNextCap("linkedin", 500, 0, 5)).toBeCloseTo(1.02);
  });
  it("con valig pide sólo remotos y saltea los avisos que ya tenemos", () => {
    const input = apifyJobInput("linkedin", "account executive", 100, 500, "valig", "week", "Argentina", { remote: true, skipJobIds: ["4480000001"] });
    expect(input).toMatchObject({ urlParam: [{ key: "f_WT", value: "2" }], skipJobId: ["4480000001"] });
    expect(apifyJobInput("linkedin", "seo", 100, 500, "valig")).not.toHaveProperty("skipJobId");
    expect(() => apifyJobInput("linkedin", "seo", 100, 500, "cheap", "week", "Argentina", { remote: true })).toThrow();
    const known = knownLinkedinIds([
      { sourceId: "apify-linkedin", externalId: "4480000001", sourceUrl: "https://www.linkedin.com/jobs/view/4480000001/", applyUrl: "" },
      { sourceId: "fantastic_jb", externalId: "x9", sourceUrl: "https://ar.linkedin.com/jobs/view/analista-at-acme-4480000002", applyUrl: "" },
      { sourceId: "greenhouse", externalId: "77", sourceUrl: "https://boards.greenhouse.io/acme/jobs/77", applyUrl: "" },
    ]);
    expect(known).toEqual(["4480000001", "4480000002"]);
  });
  it("no repite búsquedas recientes ni agotadas", () => {
    const actor = "valig/linkedin-jobs-scraper";
    const log = (at: string, keyword: string, rows: number, created?: number, extra: Record<string, string> = {}) => ({ at, provider: "apify", call: "run", params: { actor, keyword, ...extra }, rows, created });
    const now = "2026-10-22T12:00:00.000Z";
    const entries = [
      log("2026-10-19T07:00:00.000Z", "data analyst", 300),
      log("2026-10-05T07:00:00.000Z", "seo", 300, 40),
      log("2026-10-05T07:00:00.000Z", "controller", 300, 200),
      log("2026-10-21T07:00:00.000Z", "recruiter", 100, 90, { location: "Argentina", remote: "1" }),
    ];
    expect(apifyRepeatReason(entries, actor, "Data Analyst", "Argentina", false, now)).toMatch(/hace 3 días/);
    expect(apifyRepeatReason(entries, actor, "data analyst", "Argentina", true, now)).toBeNull();
    expect(apifyRepeatReason(entries, actor, "seo", "Argentina", false, now)).toMatch(/agotada/);
    expect(apifyRepeatReason(entries, actor, "controller", "Argentina", false, now)).toBeNull();
    expect(apifyRepeatReason(entries, actor, "recruiter", "Argentina", true, now)).toMatch(/hace 1 día$/);
    expect(apifyRepeatReason(entries, "cheap_scraper/linkedin-job-scraper", "data analyst", "Argentina", false, now)).toBeNull();
  });
  it("usa los límites de cada Actor y restringe el piloto", () => {
    expect(apifyJobInput("linkedin", "analista", 50)).toMatchObject({ limitPerSource: 50, scrapeCompany: false, location: "Argentina" });
    expect(apifyJobInput("indeed", "analista", 50)).toMatchObject({ count: 50, country: "ar" });
    expect(apifyJobInput("computrabajo", "analista", 50)).toMatchObject({ maxJobs: 50, countryCode: "ar" });
    expect(() => apifyJobInput("linkedin", "", 0)).toThrow();
    expect(() => apifyJobInput("linkedin", "", 100)).toThrow();
  });
});

describe("apifySourceOfActor", () => {
  it("reconoce los Actors que usamos y su fuente", () => {
    expect(apifySourceOfActor("valig/linkedin-jobs-scraper")).toEqual({ source: "linkedin", alt: true });
    expect(apifySourceOfActor("curious_coder/linkedin-jobs-scraper")).toEqual({ source: "linkedin", alt: false });
    expect(apifySourceOfActor("blackfalcondata/bumeran-scraper")).toEqual({ source: "bumeran", alt: false });
    expect(apifySourceOfActor("shahidirfan/Computrabajo-Jobs-Scraper")).toEqual({ source: "computrabajo", alt: false });
    expect(apifySourceOfActor("otro/actor")).toBeNull();
  });
});
