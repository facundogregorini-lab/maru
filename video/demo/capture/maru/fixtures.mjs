// Datos ficticios para el recorrido de Maru: la persona («Lucía Fernández») no existe.
// Las búsquedas sí son reales (ranking de producción, orden por reglas, sin IA).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const profile = JSON.parse(fs.readFileSync(path.join(here, "profile.json"), "utf8"));

export const prefs = {
  objetivo: "",
  rolesDeseados: ["Analista de Datos", "Data Analyst"],
  evitar: [],
  ciudad: "Buenos Aires",
  pais: "Argentina",
  otrosLugares: [],
  autorizacion: [],
  modalidades: ["remoto", "hibrido"],
  seniorities: ["semi_senior", "senior"],
  contratos: [],
  salario: null,
  indispensables: [],
  carrera: "continuidad",
};

export const motivation =
  "Me encanta que usen datos para decidir producto. Vengo de armar tableros en fintech y quiero sumar análisis de experimentos.";

/** Análisis de la vacante elegida (lo que devolvería /api/analyze). */
export function analysisFor(puesto, empresa) {
  return {
    puesto,
    empresa,
    idioma_vacante: "es",
    pais_empresa: "AR",
    resumen_vacante: `Buscan una persona de datos para ${empresa}: armar tableros, automatizar reportes y acompañar a los equipos de negocio con análisis.`,
    requisitos_clave: ["SQL avanzado", "Python", "Power BI o Tableau", "Comunicación con equipos de negocio"],
    palabras_clave_ats: ["SQL", "Python", "Power BI", "Tableau", "ETL", "Dashboards", "KPIs", "Data visualization", "Stakeholders", "Excel"],
    fortalezas_detectadas: [
      "Automatizaste reportes con Python y SQL: es justo lo que piden.",
      "Ya armaste tableros en Power BI que usa un comité de decisión.",
    ],
    brechas: ["El aviso pide experiencia presentando a equipos de negocio y el CV no lo muestra."],
    preguntas: [
      { id: "q1", pregunta: "¿A quiénes les presentabas tus tableros?", por_que: "Muestra que trabajás con equipos de negocio.", opciones_sugeridas: ["Comité de créditos", "Gerencia comercial", "Equipo de producto"] },
      { id: "q2", pregunta: "¿Cuántas personas usaban el tablero de riesgo?", por_que: "Le da escala a tu logro.", opciones_sugeridas: ["Menos de 10", "Entre 10 y 50", "Más de 50"] },
      { id: "q3", pregunta: "¿Usaste dbt o algún orquestador para los reportes?", por_que: "Suma palabras clave si es verdad.", opciones_sugeridas: ["Sí, Airflow", "Sí, dbt", "No"] },
    ],
    campos_formulario: [
      { campo: "¿Por qué querés trabajar con nosotros?", tipo: "texto_largo", opciones: [], obligatorio: true, fuente: "inferido" },
      { campo: "Años de experiencia con SQL", tipo: "numero", opciones: [], obligatorio: true, fuente: "inferido" },
      { campo: "Nivel de inglés", tipo: "seleccion", opciones: ["Básico", "Intermedio", "Avanzado"], obligatorio: false, fuente: "inferido" },
    ],
    template_recomendado: "moderno",
    razon_template: "Diseño limpio y moderno para un rol de datos en una empresa de tecnología.",
  };
}

/** Lo que devolvería /api/generate: reescribe con los hechos del perfil, sin inventar. */
export function generationFor(puesto, empresa) {
  return {
    titular: "Analista de Datos · SQL, Python y Power BI",
    resumen:
      "Analista de datos con 5 años en fintech y retail. Automatizo reportes con Python y SQL, armo tableros en Power BI que usan los comités para decidir y traduzco los datos en recomendaciones claras para los equipos de negocio.",
    logros_clave: [
      "Automaticé 12 reportes semanales con Python y SQL y liberé 15 horas por semana del equipo.",
      "Armé el tablero de riesgo crediticio en Power BI que usa el comité de créditos.",
      "Mejoré un 18 % el pronóstico de stock modelando ventas por sucursal.",
    ],
    habilidades: ["SQL", "Python", "Power BI", "Tableau", "ETL", "Dashboards", "KPIs", "Excel avanzado", "Google Analytics", "Estadística"],
    experiencias: [
      {
        indice: 0,
        incluir: true,
        logros: [
          "Automaticé 12 reportes semanales con Python y SQL y liberé 15 horas por semana del equipo de análisis.",
          "Diseñé el tablero de riesgo crediticio en Power BI que el comité de créditos usa en cada reunión semanal.",
          "Presenté los KPIs de cartera a la gerencia comercial y acompañé sus decisiones con análisis ad hoc.",
        ],
      },
      { indice: 1, incluir: true, logros: ["Modelé ventas por sucursal y mejoré un 18 % el pronóstico de stock."] },
    ],
    cambios_clave: [
      `Titular y resumen alineados al puesto de ${puesto} en ${empresa}.`,
      "Sumamos las palabras clave del aviso que tu experiencia respalda: KPIs, Dashboards y ETL.",
      "Ordenamos tus logros con acción, contexto y resultado.",
    ],
    recomendaciones_formulario: [
      {
        campo: "¿Por qué querés trabajar con nosotros?",
        respuesta_sugerida: `Me entusiasma que en ${empresa} los datos guíen las decisiones de producto. En Fintech del Sur armé el tablero de riesgo que usa el comité de créditos y automaticé 12 reportes semanales; quiero llevar esa experiencia a un equipo que experimente y mida.`,
        por_que: "Une tu motivación con un logro concreto del CV.",
        tip: "Si podés, nombrá un producto de la empresa que uses.",
      },
      { campo: "Años de experiencia con SQL", respuesta_sugerida: "5", por_que: "Desde 2020 usás SQL todos los días.", tip: "Poné el número exacto, sin rangos." },
      { campo: "Nivel de inglés", respuesta_sugerida: "Avanzado", por_que: "Tu CV dice Inglés C1.", tip: "Si hay entrevista en inglés, practicala en Maru." },
    ],
  };
}
