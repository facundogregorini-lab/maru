import { describe, expect, it } from "vitest";
import { apifyJobInput, normalizeApifyJobs } from "@/lib/match/apify";
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
  it("usa los límites de cada Actor y restringe el piloto", () => {
    expect(apifyJobInput("linkedin", "analista", 50)).toMatchObject({ limitPerSource: 50, scrapeCompany: false, location: "Argentina" });
    expect(apifyJobInput("indeed", "analista", 50)).toMatchObject({ count: 50, country: "ar" });
    expect(apifyJobInput("computrabajo", "analista", 50)).toMatchObject({ maxJobs: 50, countryCode: "ar" });
    expect(() => apifyJobInput("linkedin", "", 0)).toThrow();
    expect(() => apifyJobInput("linkedin", "", 100)).toThrow();
  });
});
