import { analyzeStandalone, buildOpportunities } from "@/lib/match/inventory";
import type { MatchPrefs, MatchProfile, NormalizedPosting, Salary } from "@/lib/match/types";

/**
 * Perfiles ficticios para evaluar el orden de /match (sin datos de usuarios reales).
 * El primero reproduce el caso reportado el 19/10/2026: un líder de growth con filtros
 * Manager/Director/VP y USD 7.000 por mes que veía Video Editors y avisos de USD 1.500–5.500.
 */

const prefs: MatchPrefs = {
  objetivo: "", rolesDeseados: [], evitar: [], ciudad: "Buenos Aires", pais: "Argentina",
  otrosLugares: [], autorizacion: [], modalidades: [], seniorities: [], contratos: [],
  salario: null, indispensables: [], carrera: "ambas",
};

export type EvalCase = { name: string; profile: MatchProfile; prefs: MatchPrefs };

export const EVAL_CASES: EvalCase[] = [
  {
    name: "Líder de growth (caso reportado)",
    profile: {
      headline: "Global Head of Growth Marketing | Ecommerce | IA",
      titles: ["Global Head of Growth Marketing", "Head of Online Marketing", "Cofundador"],
      skills: ["growth marketing", "performance marketing", "SEO", "SEM", "inteligencia artificial", "ecommerce", "CRM", "Meta Ads", "contenido"],
      languages: [{ language: "Español", level: "Nativo" }, { language: "Inglés", level: "Avanzado" }],
      yearsExperience: 12,
      location: "Buenos Aires, Argentina",
      summary: "Lideré growth global en Fever con un equipo de 70+ personas y presupuesto propio. Head of Online Marketing en Mercado Libre. Cofundador de un SaaS B2B.",
      leadership: { teamSize: 70, evidence: ["Equipo de 70+ personas en Fever", "Presupuesto y P&L de growth global", "Cofundador de un SaaS B2B"] },
    },
    prefs: {
      ...prefs,
      objetivo: "Growth marketing, performance, ecommerce e IA",
      modalidades: ["remoto"],
      seniorities: ["manager", "director", "ejecutivo"],
      salario: { monto: 7000, moneda: "USD", periodo: "mes", tipo: "bruto" },
    },
  },
  {
    name: "Marketing digital junior",
    profile: {
      headline: "Asistente de marketing digital",
      titles: ["Asistente de marketing digital", "Community manager freelance"],
      skills: ["Meta Ads", "Google Analytics", "redes sociales", "Canva", "Excel"],
      languages: [{ language: "Español", level: "Nativo" }, { language: "Inglés", level: "Intermedio" }],
      yearsExperience: 1.5,
      location: "Córdoba, Argentina",
      summary: "Manejo de redes y campañas chicas en Meta Ads para comercios locales.",
    },
    prefs: { ...prefs, ciudad: "Córdoba", objetivo: "Marketing digital y campañas pagas", rolesDeseados: ["Analista de marketing digital"], seniorities: ["junior", "semi_senior"] },
  },
  {
    name: "Backend senior",
    profile: {
      headline: "Senior Backend Engineer",
      titles: ["Senior Backend Engineer", "Backend Developer"],
      skills: ["Node.js", "TypeScript", "AWS", "PostgreSQL", "Docker", "Kubernetes"],
      languages: [{ language: "Español", level: "Nativo" }, { language: "Inglés", level: "Avanzado" }],
      yearsExperience: 7,
      location: "Rosario, Argentina",
      summary: "APIs y servicios de pagos en Node.js sobre AWS.",
    },
    prefs: { ...prefs, ciudad: "Rosario", rolesDeseados: ["Backend Engineer"], modalidades: ["remoto"], seniorities: ["senior", "lead"], salario: { monto: 4000, moneda: "USD", periodo: "mes", tipo: "bruto" } },
  },
  {
    name: "Cambio de carrera a UX",
    profile: {
      headline: "Docente de nivel secundario",
      titles: ["Docente de nivel secundario", "Coordinadora pedagógica"],
      skills: ["Figma", "user research", "entrevistas", "comunicación"],
      languages: [{ language: "Español", level: "Nativo" }, { language: "Inglés", level: "Intermedio" }],
      yearsExperience: 9,
      location: "Buenos Aires, Argentina",
      summary: "Docente con un curso de diseño UX y un proyecto de investigación con usuarios.",
    },
    prefs: { ...prefs, objetivo: "Diseño UX e investigación de usuarios", rolesDeseados: ["UX Researcher", "Diseñadora UX"], seniorities: ["junior"], carrera: "cambio" },
  },
];

/* ---------- avisos del set de evaluación ---------- */

const REMOTE = "Posición 100% remota para LATAM, se puede trabajar desde Argentina.";
export const EVAL_NOW = new Date("2026-10-19T12:00:00Z");

type Ad = { title: string; company: string; text: string; salary?: Partial<Salary> };
export const EVAL_ADS: Ad[] = [
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

/** Avisos fijos para el set de evaluación (no cambian con cada sincronización). */
export function evalInventory() {
  const postings = EVAL_ADS.map((ad, i) => analyzeStandalone(posting(ad, i), EVAL_NOW.toISOString()));
  return { postings, opportunities: buildOpportunities(postings) };
}
