import { describe, expect, it } from "vitest";
import { extract, familyFromTitle, seniorityFromTitle, yearsRequired } from "@/lib/match/extract";

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
  it.each([
    ["Senior Full-Stack .Net", "software"], ["Technical Lead - Java", "software"], ["Senior Database Administrator", "software"],
    ["Account Manager", "ventas"], ["Preventista Zona Rosario", "ventas"], ["Promovendedor/a (Mar del Plata)", "ventas"],
    ["Operario/a de producción", "produccion"], ["Técnico de Mantenimiento Industrial", "produccion"], ["Oficial Electricista", "produccion"],
    ["Mechanical Engineer", "produccion"], ["Ingeniero de Procesos de Operaciones", "operaciones"],
    ["Ayudante de cocina", "gastronomia"], ["Mozo/a de salón", "gastronomia"], ["Mucama Hotel 5 Estrellas", "gastronomia"],
    ["Cajero/a", "comercio"], ["Repositor Externo Full Time", "comercio"], ["Vendedor de salón", "comercio"],
    ["Vigilador General CABA", "seguridad"], ["Chofer de reparto", "logistica"], ["Enfermero/a - Chofer", "salud"],
    ["AI Trainers Network - Spanish", "entrenamiento_ia"], ["Driver / Data Collector in Cordoba, Spain", "entrenamiento_ia"],
    ["Analista de Liquidación de Sueldos", "rrhh"], ["Jefe de Personas & Cultura", "rrhh"],
    ["Representante de Envíos | Búsqueda para personas con discapacidad", "otros"],
    ["Analista de Financiamiento Inmobiliario", "finanzas"], ["Asesor Inmobiliario", "ventas"],
    ["Docente Desarrollo Full-Stack", "educacion"], ["Video Editor", "marketing"], ["Client Service Representative", "atencion_cliente"],
  ])("clasifica oficios y títulos que antes caían en Otros: %s", (title, family) => expect(familyFromTitle(title)).toBe(family));
  it.each([
    ["Ayudante de cocina", "junior"], ["Encargado/a de turno", "manager"], ["Practicante de Bienestar", "pasantia"],
  ])("deduce el seniority de %s", (title, seniority) => expect(seniorityFromTitle(title)).toBe(seniority));
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

describe("años pedidos y primer empleo", () => {
  it("lee los años en sus formas habituales", () => {
    expect(yearsRequired("Experiencia mínima de dos años en roles SEO")).toBe(2);
    expect(yearsRequired("must haves minimum 8 years of enterprise sales")).toBe(8);
    expect(yearsRequired("5 years of progressive experience in executive search")).toBe(5);
    expect(yearsRequired("3+ years designing and shipping websites")).toBe(3);
    expect(yearsRequired("Licenciatura en Administración de Empresas - mínimo 4 años de experiencia en contabilidad")).toBe(4);
    expect(yearsRequired("Experiencia mínima de 6 meses en atención al público")).toBe(0.5);
  });

  it("no confunde edades ni la historia de la empresa", () => {
    expect(yearsRequired("Aceptamos primer empleo de 18 a 24 años")).toBeNull();
    expect(yearsRequired("Somos una empresa con más de 30 años de experiencia en el rubro")).toBeNull();
    expect(yearsRequired("con más de 20 años de trayectoria en el mercado")).toBeNull();
  });

  it("un aviso sin experiencia previa es junior", () => {
    const e = extract({ title: "Vendedor/a de salón", descriptionText: "Buscamos personas para atención al público. No se requiere experiencia, te capacitamos." });
    expect(e.seniority).toMatchObject({ value: "junior", from: "descripcion" });
  });
});
