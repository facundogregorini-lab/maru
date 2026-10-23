import { describe, expect, it } from "vitest";
import { companyDomains, companyKey, domainLogo, shareCompanyLogos, withCompanyLogos } from "@/lib/match/logos";
import type { StoredPosting } from "@/lib/match/types";

const p = (key: string, company: string, companyLogo?: string) => ({ key, company, ...(companyLogo ? { companyLogo } : {}) }) as StoredPosting;

describe("logos compartidos por empresa", () => {
  it("normaliza el nombre sin sufijos societarios ni 'Argentina'", () => {
    expect(companyKey("Randstad Argentina")).toBe("randstad");
    expect(companyKey("Molinos Río de la Plata S.A.")).toBe("molinos rio de la plata");
    expect(companyKey("Newsan S.R.L.")).toBe("newsan");
  });

  it("completa el logo que falta con el de la misma empresa, y nunca en confidenciales", () => {
    const out = shareCompanyLogos([
      p("a", "Randstad Argentina", "https://img/randstad.png"),
      p("b", "Randstad"),
      p("c", "Confidencial", "https://img/x.png"),
      p("d", "Confidencial"),
      p("e", "Otra SA"),
      p("f", "Randstad", "http://inseguro/logo.png"),
    ]);
    expect(out.find((x) => x.key === "b")!.companyLogo).toBe("https://img/randstad.png");
    expect(out.find((x) => x.key === "d")!.companyLogo).toBeUndefined();
    expect(out.find((x) => x.key === "e")!.companyLogo).toBeUndefined();
    expect(out.find((x) => x.key === "f")!.companyLogo).toBe("http://inseguro/logo.png");
  });
});

describe("logo por el sitio de la empresa", () => {
  const d = (key: string, company: string, descriptionText: string) => ({ key, company, descriptionText }) as StoredPosting;
  it("usa el dominio del aviso sólo si coincide con el nombre de la empresa", () => {
    const domains = companyDomains([
      d("a", "Caylent", "Join us at caylent.com. Apply on boards.greenhouse.io or write to jobs@caylent.com"),
      d("b", "Santex", "Más info en www.santexgroup.com"),
      d("c", "Worldwide Clinical Trials", "Visit worldwide.com"),
      d("d", "Knight Piesold", "Apply at knightpiesold.catsone.com"),
      d("e", "Confidencial", "confidencial.com"),
      d("f", "Acme", "Somos partners de google.com y linkedin.com"),
    ]);
    expect(domains.get(companyKey("Caylent"))).toBe("caylent.com");
    expect(domains.get(companyKey("Santex"))).toBe("santexgroup.com");
    expect(domains.has(companyKey("Worldwide Clinical Trials"))).toBe(false);
    expect(domains.has(companyKey("Knight Piesold"))).toBe(false);
    expect(domains.has(companyKey("Confidencial"))).toBe(false);
    expect(domains.has(companyKey("Acme"))).toBe(false);
  });

  it("completa con el ícono del sitio sólo lo que no tiene logo", () => {
    const out = withCompanyLogos([d("a", "Caylent", "caylent.com"), { ...d("b", "Bunge", "bunge.com"), companyLogo: "https://img/bunge.png" }]);
    expect(out[0].companyLogo).toBe(domainLogo("caylent.com"));
    expect(out[1].companyLogo).toBe("https://img/bunge.png");
  });
});

describe("logo por dominio conocido", () => {
  it("usa el sitio oficial de empleadores frecuentes que llegan sin logo, también con aclaraciones entre paréntesis", () => {
    const out = withCompanyLogos([p("a", "JPMorganChase"), p("b", "PwC (jóvenes profesionales)"), p("c", "KPMG Argentina"), p("d", "Empresa Desconocida SA"), p("e", "EY", "https://img/ey.png")]);
    expect(out.find((x) => x.key === "a")!.companyLogo).toBe(domainLogo("jpmorganchase.com"));
    expect(out.find((x) => x.key === "b")!.companyLogo).toBe(domainLogo("pwc.com"));
    expect(out.find((x) => x.key === "c")!.companyLogo).toBe(domainLogo("kpmg.com"));
    expect(out.find((x) => x.key === "d")!.companyLogo).toBeUndefined();
    expect(out.find((x) => x.key === "e")!.companyLogo).toBe("https://img/ey.png");
  });

  it("encuentra nombres con símbolos o acentos («Helmerich & Payne», «Sovos Latinoamérica»)", () => {
    const out = withCompanyLogos([p("a", "Helmerich & Payne"), p("b", "Sovos Latinoamérica"), p("c", "Otis Elevator Co.")]);
    expect(out.find((x) => x.key === "a")!.companyLogo).toBe(domainLogo("hpinc.com"));
    expect(out.find((x) => x.key === "b")!.companyLogo).toBe(domainLogo("sovos.com"));
    expect(out.find((x) => x.key === "c")!.companyLogo).toBe(domainLogo("otis.com"));
  });
  it("reconoce los empleadores sumados el 23/10 con su forma de LinkedIn", () => {
    const out = withCompanyLogos([p("a", "BYMA Bolsas y Mercados Argentinos S.A."), p("b", "Amazon Web Services (AWS)"), p("c", "BYD Argentina"), p("d", "Kiwi")]);
    expect(out.find((x) => x.key === "a")!.companyLogo).toBe(domainLogo("byma.com.ar"));
    expect(out.find((x) => x.key === "b")!.companyLogo).toBe(domainLogo("aws.amazon.com"));
    expect(out.find((x) => x.key === "c")!.companyLogo).toBe(domainLogo("byd.com"));
    expect(out.find((x) => x.key === "d")!.companyLogo).toBeUndefined();
  });
});
