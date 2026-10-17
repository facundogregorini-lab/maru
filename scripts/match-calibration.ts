/** Auditoría determinista: perfiles ficticios contra el catálogo local, sin APIs ni IA. */
import { writeFile } from "node:fs/promises";
import { loadInventory } from "../src/lib/match/load";
import { rankOpportunities } from "../src/lib/match/ranking";
import type { MatchPrefs, MatchProfile } from "../src/lib/match/types";

const prefs: MatchPrefs = {
  objetivo: "", rolesDeseados: [], evitar: [], ciudad: "Buenos Aires", pais: "Argentina",
  otrosLugares: [], autorizacion: [], modalidades: [], seniorities: [], contratos: [],
  salario: null, indispensables: [], carrera: "continuidad",
};
const cases = [
  { name: "Administración semi senior", titles: ["Analista de Administración", "Asistente administrativa"], roles: ["Analista administrativo", "Analista de cuentas a pagar"], skills: ["Excel", "Power BI", "conciliaciones", "facturación"], years: 4, english: "Intermedio" },
  { name: "Ventas senior", titles: ["Account Executive", "Sales Development Representative"], roles: ["Account Executive", "Ejecutivo comercial"], skills: ["Ventas", "B2B", "Salesforce", "negociación", "prospección"], years: 6, english: "Avanzado" },
  { name: "Datos senior", titles: ["Data Analyst", "Business Analyst"], roles: ["Data Analyst"], skills: ["SQL", "Python", "Tableau", "Excel", "Power BI"], years: 6, english: "Avanzado" },
  { name: "Marketing junior", titles: ["Analista de marketing"], roles: ["Analista de marketing", "Marketing Assistant"], skills: ["Google Analytics", "Google Ads", "Meta Ads", "Excel", "redes sociales"], years: 1, english: "Intermedio" },
  { name: "Operaciones senior", titles: ["Analista de Operaciones", "Coordinador de procesos"], roles: ["Operations Analyst", "Analista de procesos"], skills: ["Excel", "SQL", "operaciones", "gestión de proyectos"], years: 10, english: "Avanzado" },
];

async function main() {
  const { inv, postings } = await loadInventory();
  const now = new Date("2026-10-17T12:00:00Z");
  const profiles = cases.map((c) => {
    const profile: MatchProfile = {
      headline: c.titles[0], titles: c.titles, skills: c.skills, yearsExperience: c.years,
      languages: [{ language: "Español", level: "Nativo" }, { language: "Inglés", level: c.english }],
      location: "Buenos Aires, Argentina", summary: "Perfil ficticio para QC",
    };
    const { eligible } = rankOpportunities({
      opportunities: inv.opportunities, postings, profile, prefs: { ...prefs, rolesDeseados: c.roles },
      interactions: { saved: [], discarded: [] }, limit: 10000, now,
    });
    const top20 = eligible.slice(0, 20);
    return {
      profile: c.name, eligible: eligible.length, max: eligible[0]?.score ?? null,
      top20Mean: top20.length ? Math.round(top20.reduce((s, r) => s + r.score, 0) / top20.length) : null,
      atLeast70: eligible.filter((r) => r.score >= 70).length,
      atLeast90: eligible.filter((r) => r.score >= 90).length,
      top5: eligible.slice(0, 5).map(({ id, title, company, score, confidence, gaps }) => ({ id, title, company, score, confidence, gaps })),
    };
  });
  const result = JSON.stringify({
    evaluatedAt: now.toISOString(), inventoryAt: inv.generatedAt,
    note: "Perfiles sintéticos; prueba de coherencia, no validación con contrataciones ni cobertura del mercado.",
    profiles,
  }, null, 2) + "\n";
  const out = process.argv[2];
  if (out) await writeFile(out, result);
  else process.stdout.write(result);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
