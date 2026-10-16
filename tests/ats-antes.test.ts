import { describe, expect, it } from "vitest";
import { atsBefore, atsReport } from "@/lib/ats";
import { buildCvDoc } from "@/lib/cv";
import type { CvContext, Profile } from "@/lib/schemas";

const profile = {
  nombre: "Ana",
  titulo: "Analista",
  ubicacion: "CABA",
  email: "ana@x.com",
  telefono: "",
  linkedin_url: "",
  otros_links: [],
  resumen: "Analista con experiencia en reportes.",
  aptitudes: ["Excel"],
  experiencia: [{ empresa: "Acme", cargo: "Analista", ubicacion: "", inicio: "2020", fin: "actual", descripcion: "", logros: ["Armé reportes mensuales"], fragmentos_incompletos: [] }],
  educacion: [],
  idiomas: [],
  certificaciones: [],
} as unknown as Profile;

const ctx = { idioma: "es", pais: "AR", puesto: "Data Analyst", palabrasClave: ["SQL", "Power BI", "Python"], templateRecomendado: "moderno" } as unknown as CvContext;

describe("ATS antes y después", () => {
  it("el CV reescrito con las palabras clave puntúa más que el original", () => {
    const before = atsBefore(profile, ctx);
    const after = atsReport(
      buildCvDoc(profile, { titular: "Data Analyst", resumen: "Data Analyst con SQL, Power BI y Python.", logros_clave: [], habilidades: ["SQL", "Power BI", "Python"], experiencias: [] }, ctx),
      ctx.palabrasClave,
    ).score;
    expect(after).toBeGreaterThan(before);
  });
});
