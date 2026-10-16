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
