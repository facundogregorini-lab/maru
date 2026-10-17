import { describe, expect, it } from "vitest";
import { familyFromTitle } from "@/lib/match/extract";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { normalizeFantastic } from "@/lib/match/providers";
import { argentinaFirst, parseRole, rankOpportunities, roleSimilarity } from "@/lib/match/ranking";
import type { MatchPrefs, MatchProfile } from "@/lib/match/types";
import { basePrefs, noInteractions } from "./match-helpers";

/** Ajustes del benchmark E0 (docs/research/e1-ranking-2026-10-17). */
const NOW = new Date("2026-10-17T12:00:00Z");
const desc = "Liquidación de impuestos, conciliaciones bancarias, cuentas a pagar y reportes contables mensuales con Excel. ".repeat(4);
const row = (id: string, title: string, company: string, extra: Record<string, unknown> = {}) => ({ id, title, organization: company, url: `https://jobs.example.com/${id}`, date_posted: "2026-10-10T00:00:00", countries_derived: ["Argentina"], locations_derived: ["Córdoba, Córdoba, Argentina"], remote_derived: true, description_text: desc, ...extra });
const profile: MatchProfile = { headline: "Analista contable", titles: ["Analista contable"], skills: ["Excel"], languages: [{ language: "Español", level: "Nativo" }], yearsExperience: 3, location: "Córdoba, Argentina", summary: "" };
const prefs: MatchPrefs = { ...basePrefs, rolesDeseados: ["Analista contable"], ciudad: "Córdoba", modalidades: ["remoto", "hibrido"], seniorities: ["semi_senior"], indispensables: [] };

function rank(rows: ReturnType<typeof row>[]) {
  const inv = emptyInventory("fixture");
  applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings: normalizeFantastic(rows, "fantastic_ats", "test", NOW.getTime()).postings, complete: false }, NOW.toISOString());
  inv.opportunities = buildOpportunities(inv.postings);
  return rankOpportunities({ opportunities: inv.opportunities, postings: new Map(inv.postings.map((p) => [p.key, p])), profile, prefs, interactions: noInteractions, now: NOW, limit: 20 });
}

describe("ranking: ajustes de E0", () => {
  it("como mucho 2 avisos de la misma empresa en los primeros 10", () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => row(`a${i}`, `Analista contable ${i + 1}`, "Agencia Única")),
      ...Array.from({ length: 10 }, (_, i) => row(`b${i}`, `Analista de cuentas a pagar ${i + 1}`, `Empresa ${i}`)),
    ];
    const top10 = rank(rows).eligible.slice(0, 10);
    expect(top10.filter((i) => i.company === "Agencia Única")).toHaveLength(2);
  });

  it("convocatorias abiertas y proyectos de entrenamiento de IA bajan y lo explican", () => {
    const out = rank([
      row("pool", "Analista contable - Talent Pool", "Pools SA"),
      row("ia", "Analista contable", "Datos para IA", { description_text: `We create training data for frontier AI models. ${desc}` }),
      row("real", "Analista contable", "Empresa Real"),
    ]);
    expect(out.eligible[0].company).toBe("Empresa Real");
    expect(out.eligible.find((i) => i.company === "Pools SA")!.pending.join(" ")).toMatch(/convocatoria abierta/);
  });

  it("presencial fuera de los lugares elegidos y avisos de más de 6 meses quedan detrás", () => {
    const out = rank([
      row("lejos", "Analista contable", "Lejos SA", { remote_derived: false, ai_work_arrangement: "On-site", locations_derived: ["Ushuaia, Tierra del Fuego, Argentina"] }),
      row("viejo", "Analista contable", "Viejo SA", { date_posted: "2026-03-01T00:00:00" }),
      row("bien", "Analista contable", "Bien SA"),
    ]);
    expect(out.eligible[0].company).toBe("Bien SA");
    expect(out.eligible.find((i) => i.company === "Lejos SA")!.gaps.join(" ")).toMatch(/fuera de los lugares/);
  });

  it("Argentina primero en las ubicaciones y RevOps/IT Ops fuera de operaciones", () => {
    expect(argentinaFirst(["South Africa - Cape Town", "Chile", "Argentina - Buenos Aires"])[0]).toBe("Argentina - Buenos Aires");
    expect(familyFromTitle("Revenue Operations Analyst")).toBe("ventas");
    expect(familyFromTitle("IT Operations Analyst")).toBe("software");
    expect(familyFromTitle("Analista de operaciones logísticas")).toBe("logistica");
  });
});

describe("ranking: tipo de puesto además del área", () => {
  const sim = (a: string, b: string) => roleSimilarity(parseRole(a), parseRole(b));
  it("compara por área y tipo de puesto, sin lugares ni ruido del aviso", () => {
    expect(sim("Analista de logística", "Analista de Logística SSR")).toBeGreaterThanOrEqual(0.9);
    expect(sim("Analista de logística", "Coordinador/a de Logística zona Tucumán")).toBeGreaterThan(0.75);
    expect(sim("Analista de logística", "Chofer de logística")).toBeLessThan(0.5);
    expect(sim("Analista de logística", "Analista de calidad")).toBeLessThan(0.1);
    expect(sim("Vendedor", "Vigilador en local comercial")).toBeLessThan(0.5);
    expect(sim("Asistente administrativo", "Auxiliar Administrativo Comercial")).toBeGreaterThan(0.75);
  });

  it("un puesto operativo del mismo rubro no lidera para un perfil administrativo", () => {
    const out = rank([row("op", "Operario contable de depósito", "Depósito SA"), row("ok", "Analista contable", "Contable SA")]);
    expect(out.eligible[0].company).toBe("Contable SA");
    const op = out.eligible.find((i) => i.company === "Depósito SA");
    if (op) expect(op.score).toBeLessThan(out.eligible[0].score - 15);
  });
});
