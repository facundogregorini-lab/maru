import { z } from "zod";

export const FormFieldSchema = z.object({
  campo: z.string().describe("Etiqueta del campo tal como aparece (o como suele aparecer) en el formulario"),
  tipo: z.enum(["texto_corto", "texto_largo", "seleccion", "si_no", "numero", "archivo", "otro"]),
  opciones: z.array(z.string()).describe("Opciones disponibles si es un campo de selección; vacío si no aplica"),
  obligatorio: z.boolean(),
  fuente: z.enum(["detectado", "inferido"]).describe("detectado = estaba en la página; inferido = es habitual en este tipo de proceso"),
});

export const QuestionSchema = z.object({
  id: z.string(),
  pregunta: z.string().describe("Pregunta corta, simple y cálida, de una sola idea"),
  por_que: z.string().describe("En una frase, para qué sirve la respuesta"),
  opciones_sugeridas: z.array(z.string()).describe("2-4 respuestas rápidas posibles; vacío si es abierta"),
});

export const AnalysisSchema = z.object({
  puesto: z.string(),
  empresa: z.string(),
  idioma_vacante: z.string().describe("Código ISO del idioma de la publicación, ej. 'es' o 'en'"),
  resumen_vacante: z.string().describe("2-3 frases sobre el rol y qué buscan"),
  requisitos_clave: z.array(z.string()),
  palabras_clave_ats: z.array(z.string()).describe("Términos exactos de la publicación que un ATS probablemente busque"),
  fortalezas_detectadas: z.array(z.string()).describe("Por qué esta persona encaja, basado en su CV y su feedback"),
  brechas: z.array(z.string()).describe("Requisitos que el CV no evidencia todavía"),
  preguntas: z.array(QuestionSchema).describe("Entre 3 y 5 preguntas para cubrir brechas y conseguir datos concretos"),
  campos_formulario: z.array(FormFieldSchema),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export const CVSchema = z.object({
  nombre: z.string(),
  titular: z.string().describe("Título profesional alineado al rol, usando el nombre del puesto de la vacante cuando sea honesto"),
  contacto: z.object({
    email: z.string(),
    telefono: z.string(),
    ubicacion: z.string(),
    linkedin: z.string(),
    otros: z.array(z.string()),
  }),
  titulos_secciones: z.object({
    resumen: z.string(),
    competencias: z.string(),
    experiencia: z.string(),
    educacion: z.string(),
    certificaciones: z.string(),
    idiomas: z.string(),
  }).describe("Títulos estándar de sección en el idioma del CV (ATS-friendly)"),
  resumen: z.string(),
  competencias: z.array(z.string()),
  experiencia: z.array(
    z.object({
      cargo: z.string(),
      empresa: z.string(),
      ubicacion: z.string(),
      periodo: z.string(),
      logros: z.array(z.string()),
    }),
  ),
  educacion: z.array(
    z.object({
      titulo: z.string(),
      institucion: z.string(),
      periodo: z.string(),
      detalle: z.string(),
    }),
  ),
  certificaciones: z.array(z.string()),
  idiomas: z.array(z.string()),
  secciones_extra: z.array(z.object({ titulo: z.string(), items: z.array(z.string()) })),
});
export type CV = z.infer<typeof CVSchema>;

export const ResultSchema = z.object({
  cv: CVSchema,
  cambios_clave: z.array(z.string()).describe("Qué se ajustó del CV original y por qué, en lenguaje simple"),
  cobertura_ats: z.object({
    incluidas: z.array(z.string()),
    faltantes: z.array(z.string()).describe("Palabras clave que no se incluyeron porque no hay evidencia real"),
    nota: z.string(),
  }),
  completar_antes_de_enviar: z.array(z.string()).describe("Datos marcados como [completar] que la persona debe revisar"),
  recomendaciones_formulario: z.array(
    z.object({
      campo: z.string(),
      respuesta_sugerida: z.string().describe("Texto listo para copiar y pegar"),
      por_que: z.string(),
      tip: z.string(),
    }),
  ),
});
export type Result = z.infer<typeof ResultSchema>;

/** Lo que el navegador envía en ambos pasos. */
export type CandidateInput = {
  jobUrl: string;
  jobText?: string;
  feedback: string;
  cvPdfBase64?: string;
  cvText?: string;
  linkedinUrl?: string;
};
