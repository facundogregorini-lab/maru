import type { MatchPrefs, MatchProfile } from "@/lib/match/types";

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
