import { describe, expect, it } from "vitest";
import { seniorityFromTitle } from "@/lib/match/extract";
import { functionMismatch, functionOf, levelVerdict, monthlyMax, postingLevel, profileLevel, salaryMeets, targetRange } from "@/lib/match/fit";
import { leadershipFrom } from "@/lib/match/profile";
import type { Extracted } from "@/lib/match/types";
import { basePrefs, dataProfile } from "./match-helpers";

const noLevel: Pick<Extracted, "seniority"> = { seniority: null };
const leaderPrefs = { ...basePrefs, seniorities: ["manager", "director", "ejecutivo"] as const };
const range = targetRange({ ...basePrefs, seniorities: [...leaderPrefs.seniorities] }, dataProfile);

describe("nivel del aviso", () => {
  it("lee SVP/EVP como ejecutivo y Head como dirección", () => {
    expect(seniorityFromTitle("Global SVP of Marketing")).toBe("ejecutivo");
    expect(postingLevel("Head of Marketing", noLevel)).toMatchObject({ level: "director", certain: true });
  });
  it("un Manager sin equipo a cargo es dudoso; con equipo, no", () => {
    expect(postingLevel("Growth Marketing Manager", noLevel, "Run paid campaigns.")).toMatchObject({ level: "manager", certain: false });
    expect(postingLevel("Growth Marketing Manager", noLevel, "You will manage a team of 6 marketers.")).toMatchObject({ level: "manager", certain: true, leadsPeople: true });
  });
  it("los cargos individuales nunca son de liderazgo, aunque pidan muchos años", () => {
    expect(postingLevel("Programmatic Specialist", { seniority: { value: "lead", from: "descripcion" } })).toMatchObject({ level: "senior", ic: true });
    expect(postingLevel("Video Editor", noLevel)).toMatchObject({ ic: true });
  });
});

describe("filtro de nivel", () => {
  it("excluye lo de nivel inferior y deja por confirmar lo dudoso", () => {
    expect(levelVerdict(postingLevel("Analista Marketing Digital", noLevel), range).action).toBe("excluir");
    expect(levelVerdict(postingLevel("Video Editor", noLevel), range).action).toBe("excluir");
    expect(levelVerdict(postingLevel("Marketing Manager", noLevel, "Own the content calendar."), range).action).toBe("pendiente");
    expect(levelVerdict(postingLevel("Head of Growth", noLevel), range).action).toBe("ok");
    expect(levelVerdict(postingLevel("Growth Strategy", noLevel), range).action).toBe("pendiente");
  });
  it("sin niveles elegidos no filtra; para un junior, excluye la dirección", () => {
    expect(levelVerdict(postingLevel("Analista", noLevel), targetRange(basePrefs, dataProfile)).action).toBe("ok");
    const junior = targetRange({ ...basePrefs, seniorities: ["junior"] }, dataProfile);
    expect(levelVerdict(postingLevel("Head of Marketing", noLevel), junior).action).toBe("excluir");
    expect(levelVerdict(postingLevel("Analista de marketing", noLevel), junior).action).toBe("ok");
  });
});

describe("nivel demostrado en el CV", () => {
  it("usa el cargo más alto y el equipo a cargo, no sólo los años", () => {
    expect(profileLevel({ ...dataProfile, titles: ["Global Head of Growth Marketing"] })).toBe("director");
    expect(profileLevel({ ...dataProfile, titles: ["Growth Marketing Manager"], leadership: { teamSize: 20, evidence: [] } })).toBe("director");
    expect(profileLevel({ ...dataProfile, yearsExperience: 18 })).toBe("senior");
  });
  it("extrae el equipo más grande del CV con su evidencia", () => {
    const l = leadershipFrom({
      resumen: "Lideré un equipo de 70+ personas en Fever.",
      experiencia: [{ empresa: "Mercado Libre", cargo: "Head of Online Marketing", inicio: "2015", fin: "2019", ubicacion: "", descripcion: "Gestioné un presupuesto anual de USD 20M.", logros: ["Equipo de 2025 iniciativas"], fragmentos_incompletos: [] }],
    });
    expect(l?.teamSize).toBe(70);
    expect(l?.evidence).toHaveLength(2);
  });
});

describe("función", () => {
  it("separa video, diseño y comunidad de un rol de growth", () => {
    expect(functionOf("Video Editor – Performance Creative (E-commerce)")).toBe("video");
    expect(functionOf("Head of Growth")).toBeNull();
    const growth = { ...dataProfile, headline: "Head of Growth", titles: ["Head of Growth"] };
    expect(functionMismatch("Video Editor", growth, basePrefs)).toBe(true);
    expect(functionMismatch("Community Manager", { ...growth, titles: ["Community manager"] }, basePrefs)).toBe(false);
    expect(functionMismatch("Video Editor", growth, { ...basePrefs, carrera: "cambio" })).toBe(false);
  });
});

describe("salario", () => {
  it("compara por mes en la misma moneda; otra moneda queda para la IA", () => {
    const prefs = { ...basePrefs, salario: { monto: 7000, moneda: "USD" as const, periodo: "mes" as const, tipo: "bruto" as const } };
    expect(salaryMeets({ min: 3000, max: 4000, currency: "USD", period: "mes" }, prefs)).toBe(false);
    expect(salaryMeets({ min: 100000, max: 120000, currency: "USD", period: "anio" }, prefs)).toBe(true);
    expect(salaryMeets({ min: 50, max: 60, currency: "USD", period: "hora" }, prefs)).toBe(true);
    expect(salaryMeets({ min: 4000, max: 5500, currency: "", period: "desconocido" }, prefs)).toBeNull();
    expect(salaryMeets({ min: 5000, max: 9000, currency: "EUR", period: "mes" }, prefs)).toBeNull();
    expect(monthlyMax({ min: 40, max: null, currency: "USD", period: "hora" })).toBe(6400);
  });
});
