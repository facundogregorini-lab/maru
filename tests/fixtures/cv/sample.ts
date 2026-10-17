import { buildCvDoc } from "@/lib/cv";
import type { Analysis, CvContext, Profile } from "@/lib/schemas";

export const profile: Profile = {
  nombre: "Ana Pérez", titulo: "Analista de datos", ubicacion: "Buenos Aires", email: "ana@example.test", telefono: "",
  linkedin_url: "", otros_links: [], resumen: "Analista de datos con experiencia en reportes de ventas.", aptitudes: ["SQL", "Power BI"],
  experiencia: [{ empresa: "Empresa de prueba", cargo: "Analista de datos", inicio: "03/2021", fin: "actual", ubicacion: "Buenos Aires", descripcion: "Reportes de ventas", logros: ["Automaticé los reportes mensuales con SQL."], fragmentos_incompletos: [] }],
  educacion: [], idiomas: [{ idioma: "Español", nivel: "Nativo" }], certificaciones: [],
};
export const context: CvContext = { puesto: "Analista de datos", idioma: "es", pais: "AR", palabrasClave: ["SQL", "Power BI"], templateRecomendado: "moderno", razonTemplate: "" };
export const generation = { titular: "Analista de datos", resumen: "Analista de datos con experiencia en reportes de ventas y automatización de consultas SQL.", logros_clave: ["Automaticé los reportes mensuales con SQL."], habilidades: ["SQL", "Power BI"], experiencias: [{ indice: 0, incluir: true, logros: ["Automaticé los reportes mensuales con SQL."] }], cambios_clave: [], recomendaciones_formulario: [] };
export const analysis: Analysis = {
  puesto: "Analista de datos", empresa: "Empresa de prueba", resumen_vacante: "El puesto busca experiencia con SQL y Power BI para preparar reportes de ventas.",
  pais_empresa: "AR", idioma_vacante: "es", requisitos_clave: ["SQL", "Power BI"], palabras_clave_ats: ["SQL", "Power BI"],
  fortalezas_detectadas: ["Experiencia con reportes SQL"], brechas: ["Falta detallar el alcance de los reportes"],
  preguntas: [{ id: "q1", pregunta: "¿Quiénes usaban tus reportes?", por_que: "Permite mostrar el alcance de tu trabajo.", opciones_sugeridas: [] }],
  campos_formulario: [], template_recomendado: "moderno", razon_template: "Diseño simple para un rol de datos.",
};
export const sampleCv = () => buildCvDoc(profile, generation, context);
