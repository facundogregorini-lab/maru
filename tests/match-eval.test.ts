import { describe, expect, it } from "vitest";
import { analyzeStandalone, buildOpportunities } from "@/lib/match/inventory";
import { rankOpportunities, type RankedItem } from "@/lib/match/ranking";
import type { NormalizedPosting, Salary } from "@/lib/match/types";
import { EVAL_CASES } from "./match-eval-cases";

/**
 * Set de evaluación del orden de /match (caso reportado el 19/10/2026 y tres perfiles más para no
 * sobreajustar). Avisos ficticios con títulos reales del inventario; corre sin red ni IA.
 */

const REMOTE = "Posición 100% remota para LATAM, se puede trabajar desde Argentina.";
const NOW = new Date("2026-10-19T12:00:00Z");

type Ad = { title: string; company: string; text: string; salary?: Partial<Salary> };
const ADS: Ad[] = [
  { title: "Head of Marketing - Argentina / Uruguay", company: "Halter", text: "Vas a liderar el equipo de marketing de Argentina y Uruguay, con presupuesto propio y reportando al Country Manager. Estrategia de growth, marca y performance." },
  { title: "Head of Growth", company: "Fintual", text: "Liderás un equipo de 8 personas de growth y performance marketing. Owner del P&L de adquisición. Reporta al CEO." },
  { title: "Director of Growth Marketing", company: "Kavak", text: "Build and lead a team of 15 across paid acquisition, CRM and lifecycle. You will own the budget and report to the CMO." },
  { title: "VP of Marketing", company: "Ualá", text: "Reporting to the CEO, you will lead marketing, brand and growth teams (40 people) and own the marketing P&L." },
  { title: "Marketing Director LATAM", company: "Rappi", text: "Lead the regional marketing team with 20 direct reports.", salary: { min: 120000, max: 160000, currency: "USD", period: "anio" } },
  { title: "Head of Growth", company: "Scale Army", text: "Lead our growth team of 5. Paid media, SEO and CRM.", salary: { min: 3000, max: 4000, currency: "USD", period: "mes" } },
  { title: "Growth Marketing Manager", company: "Hire Hangar", text: "Manage paid campaigns, SEO and SEM for ecommerce clients.", salary: { min: 2500, max: 3000, currency: "USD", period: "mes" } },
  { title: "Senior Marketing Manager", company: "Hire Hangar Dos", text: "Lead a team of 4 marketers. Performance marketing, Meta Ads and SEM.", salary: { min: 1500, max: 5500, currency: "USD", period: "mes" } },
  { title: "Video Editor", company: "Acentecom", text: "Editar videos para campañas de ecommerce con herramientas de IA. Requisitos: inteligencia artificial, ecommerce, Premiere." },
  { title: "Video Editor – Performance Creative (E-commerce)", company: "Rehire", text: "Edit performance creatives for ecommerce brands. Requirements: performance marketing, ecommerce, Meta Ads." },
  { title: "Analista Marketing Digital", company: "Dia Argentina", text: "Gestión de campañas en Meta Ads y Google Analytics, reportes de redes sociales. Requisitos: marketing digital, Meta Ads, Google Analytics." },
  { title: "Programmatic Specialist", company: "Aleph", text: "Run programmatic campaigns, performance marketing and reporting. 3+ years of experience." },
  { title: "Senior Backend Engineer", company: "Mercado Pago", text: "Servicios de pagos en Node.js y TypeScript sobre AWS. Requisitos: Node.js, TypeScript, AWS, PostgreSQL, Docker." },
  { title: "Engineering Manager", company: "Despegar", text: "Lead a team of 8 engineers. Node.js and AWS." },
  { title: "UX Researcher Jr", company: "Globant", text: "Entrevistas con usuarios y tests de usabilidad. Requisitos: user research, Figma." },
  { title: "Diseñador UX Junior", company: "Naranja X", text: "Diseño de flujos y prototipos en Figma. Requisitos: Figma, ux." },
  { title: "Docente de Matemática", company: "Colegio Norte", text: "Docente de nivel secundario para matemática." },
];

function posting(ad: Ad, i: number): NormalizedPosting {
  return {
    sourceId: "greenhouse", boardId: `greenhouse:eval${i}`, externalId: `e${i}`, title: ad.title, company: ad.company,
    sourceUrl: `https://boards.greenhouse.io/eval${i}/jobs/${i}`, applyUrl: `https://boards.greenhouse.io/eval${i}/jobs/${i}`, linkRequired: false,
    descriptionText: `${ad.text}\n\n${REMOTE}\n\n${"Detalle del puesto. ".repeat(25)}`, descriptionComplete: true,
    locations: ["Argentina"], countries: ["AR"], regionText: ["LATAM"], workplace: { value: "remoto", from: "fuente" }, remoteFlag: true,
    employmentType: { value: "full_time", from: "fuente" },
    salary: ad.salary ? { value: { min: null, max: null, currency: "USD", period: "mes", ...ad.salary }, from: "fuente" } : null,
    publishedAt: "2026-10-15T00:00:00Z", updatedAt: null, expiresAt: null,
  };
}

const postings = ADS.map((ad, i) => analyzeStandalone(posting(ad, i), NOW.toISOString()));
const opportunities = buildOpportunities(postings);

function rank(name: string) {
  const c = EVAL_CASES.find((x) => x.name.startsWith(name))!;
  return rankOpportunities({ opportunities, postings: new Map(postings.map((p) => [p.key, p])), profile: c.profile, prefs: c.prefs, interactions: { saved: [], discarded: [] }, now: NOW });
}
const titles = (xs: RankedItem[]) => xs.map((x) => x.title);

describe("evaluación: líder de growth con Manager/Director/VP y USD 7.000", () => {
  const r = rank("Líder de growth");
  const shown = [...r.eligible, ...r.pending];

  it("no muestra funciones ajenas, niveles inferiores ni salarios menores al pedido", () => {
    for (const t of ["Video Editor", "Video Editor – Performance Creative (E-commerce)", "Analista Marketing Digital", "Programmatic Specialist"]) {
      expect(titles(shown)).not.toContain(t);
    }
    // Head of Growth de Scale Army (USD 3.000–4.000), Growth Marketing Manager (USD 2.500–3.000), Senior Marketing Manager (hasta 5.500).
    expect(shown.filter((x) => x.company === "Scale Army" || x.company.startsWith("Hire Hangar"))).toEqual([]);
  });

  it("deja arriba los roles de liderazgo de marketing y growth", () => {
    const top = titles(r.eligible.slice(0, 5));
    expect(top).toContain("Head of Marketing - Argentina / Uruguay");
    for (const t of ["Head of Growth", "Director of Growth Marketing", "VP of Marketing", "Marketing Director LATAM"]) expect(top).toContain(t);
    expect(r.eligible[0].reasons[0]).toMatch(/^Tu experiencia como .*70\+ personas/);
  });

  it("las razones empiezan por el rol y el nivel, nunca por el área o la modalidad", () => {
    for (const x of r.eligible) {
      expect(x.reasons[0]).not.toMatch(/^(Es del área|Es remoto|Se puede trabajar desde)/);
      expect(x.reasons.join(" ")).not.toMatch(/Es del área que te interesa/);
    }
  });

  it("devuelve el puntaje por componente", () => {
    const b = r.eligible[0].breakdown;
    expect(b.rol.max + b.seniority.max + b.requisitos.max + b.preferencias.max).toBe(100);
    expect(b.nivelAviso).toBe("director");
  });
});

describe("evaluación: otros perfiles (para no sobreajustar)", () => {
  it("marketing junior: ve el analista de marketing digital y ningún puesto de dirección", () => {
    const r = rank("Marketing digital junior");
    expect(titles(r.eligible.slice(0, 2))).toContain("Analista Marketing Digital");
    expect(titles(r.eligible).filter((t) => /head|director|vp/i.test(t))).toEqual([]);
  });

  it("backend senior: primero el backend; no ve gerencias ni marketing", () => {
    const r = rank("Backend senior");
    expect(r.eligible[0].title).toBe("Senior Backend Engineer");
    expect(titles(r.eligible)).not.toContain("Video Editor");
    expect(titles(r.eligible).filter((t) => /marketing|growth/i.test(t))).toEqual([]);
  });

  it("cambio de carrera a UX: el filtro de función no le vacía la lista", () => {
    const r = rank("Cambio de carrera");
    expect(titles(r.eligible.slice(0, 2)).sort()).toEqual(["Diseñador UX Junior", "UX Researcher Jr"]);
  });
});
