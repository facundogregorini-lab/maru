import { describe, expect, it } from "vitest";
import { familyFromTitle, seniorityFromTitle, yearsRequired } from "@/lib/match/extract";

describe("calidad de los avisos locales", () => {
  it.each([
    ["Analista de finanzas", "finanzas"], ["Analista de Contabilidad", "finanzas"],
    ["Analista de cuentas a pagar", "finanzas"], ["Analista de Presupuesto", "finanzas"],
    ["Analista Junior de Costos", "finanzas"], ["Senior Pricing Analyst", "finanzas"],
    ["Analista de comercio exterior sr", "logistica"], ["Analista de Calidad", "operaciones"],
    ["Data Reporting Analyst", "datos"], ["Crossborder Product Analyst", "producto"],
    ["Analista IT Networking", "software"], ["Analista de Redes y Telecomunicaciones", "software"],
    ["ADMINISTRADOR DE DOCUMENTOS", "administracion"], ["Analista Técnico Ssr", "otros"],
  ])("clasifica %s por el título explícito", (title, family) => expect(familyFromTitle(title)).toBe(family));
  it("respeta el seniority semi senior explícito antes de buscar senior", () => {
    expect(seniorityFromTitle("Data Scientist Semi Senior")).toBe("semi_senior");
    expect(seniorityFromTitle("Data Scientist Senior")).toBe("senior");
  });
  it.each([
    ["10–15 years of professional graphic design experience", 10],
    ["3 to 5 years of experience", 3], ["Entre 2 y 4 años de experiencia", 2],
    ["1,5 años de experiencia", 1.5], ["2.5 years of experience", 2.5],
    ["100 years of experience", null], ["5+ years of experience", 5],
  ])("extrae el mínimo de %s sin tomar el último número del rango", (text, years) => expect(yearsRequired(text)).toBe(years));
});

describe("inglés implícito (aviso escrito en inglés)", async () => {
  const { extract, writtenInEnglish, ENGLISH_IMPLICIT } = await import("@/lib/match/extract");
  const en = "We are looking for a Customer Service Representative to join our team. You will handle calls with our clients and work with the collections team. This is a full-time role and you will report to the operations manager. Experience with CRM tools is a plus and we offer great benefits for the team.";
  const es = "Buscamos un representante de atención al cliente para sumarse a nuestro equipo. Vas a atender llamados de los clientes y trabajar con el equipo de cobranzas. Es un puesto full time con experiencia en CRM y la posibilidad de crecer en la empresa.";
  it("lo detecta y lo marca como requisito avanzado cuando el aviso no dice el nivel", () => {
    expect(writtenInEnglish(en)).toBe(true);
    expect(writtenInEnglish(es)).toBe(false);
    expect(extract({ title: "Customer Service Representative", descriptionText: en }).languages).toEqual([{ language: "inglés", level: ENGLISH_IMPLICIT, required: true }]);
    expect(extract({ title: "Representante de atención al cliente", descriptionText: es }).languages).toEqual([]);
  });
  it("detecta idiomas pedidos en el título", () => {
    expect(extract({ title: "Recruiter con CHINO", descriptionText: es }).languages.map((l) => l.language)).toContain("chino");
  });
  it("respeta el nivel cuando el aviso lo declara", () => {
    const langs = extract({ title: "Support", descriptionText: `${en} Intermediate English is required.` }).languages;
    expect(langs).toEqual([{ language: "inglés", level: "intermediate", required: true }]);
  });
});
