import { z } from "zod";

/* ---------- Perfil extraído de LinkedIn / CV ---------- */

export const ProfileSchema = z.object({
  nombre: z.string(),
  titulo: z.string().describe("Titular o título profesional tal como figura"),
  ubicacion: z.string(),
  email: z.string(),
  telefono: z.string(),
  linkedin_url: z.string(),
  otros_links: z.array(z.string()),
  resumen: z.string().describe("Extracto / resumen tal como figura (puede venir vacío)"),
  aptitudes: z.array(z.string()),
  experiencia: z.array(
    z.object({
      empresa: z.string(),
      cargo: z.string().describe("Cargo exacto, sin traducir ni reformular"),
      inicio: z.string().describe("MM/AAAA, o AAAA si sólo figura el año, o '' si no figura"),
      fin: z.string().describe("MM/AAAA, AAAA, 'actual' si es el puesto vigente, o '' si no figura"),
      ubicacion: z.string(),
      descripcion: z.string().describe("Descripción de la empresa o del rol si la hay, textual"),
      logros: z.array(z.string()).describe("Cada logro o párrafo de responsabilidades tal como figura en la fuente"),
      fragmentos_incompletos: z
        .array(z.string())
        .describe(
          "Frases de la fuente a las que les faltan palabras o cifras (ej. 'Achieved , expanded to 4 countries'). LinkedIn suele perder el texto en negrita al exportar a PDF.",
        ),
    }),
  ),
  educacion: z.array(
    z.object({
      institucion: z.string(),
      titulo: z.string(),
      inicio: z.string().describe("AAAA o ''"),
      fin: z.string().describe("AAAA, 'en curso' o ''"),
    }),
  ),
  idiomas: z.array(z.object({ idioma: z.string(), nivel: z.string().describe("Nivel tal como figura, o '' si no figura") })),
  certificaciones: z.array(z.object({ nombre: z.string(), emisor: z.string(), anio: z.string() })),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Pregunta para completar un dato que no está en la fuente. `path` indica dónde va la respuesta. */
export type GapQuestion = {
  id: string;
  path: string;
  pregunta: string;
  placeholder: string;
  contexto?: string;
};

/* ---------- Análisis de la vacante ---------- */

export const TEMPLATE_IDS = ["clasico", "moderno", "ejecutivo", "minimal"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

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
  pais_empresa: z.string().describe("Código ISO-3166 alfa-2 del país donde está el puesto (ej. 'AR', 'US', 'GB', 'ES'); '' si no se sabe"),
  resumen_vacante: z.string().describe("2-3 frases sobre el rol y qué buscan"),
  requisitos_clave: z.array(z.string()),
  palabras_clave_ats: z
    .array(z.string())
    .describe("10-20 términos exactos y cortos (1-3 palabras) de la publicación que un ATS probablemente busque"),
  fortalezas_detectadas: z.array(z.string()).describe("Por qué esta persona encaja, basado en su CV y su feedback"),
  brechas: z.array(z.string()).describe("Requisitos que el CV no evidencia todavía"),
  preguntas: z
    .array(QuestionSchema)
    .describe("Entre 3 y 5 preguntas para cubrir brechas y conseguir logros concretos. No preguntes datos que ya están en el CV."),
  campos_formulario: z.array(FormFieldSchema),
  template_recomendado: z.enum(TEMPLATE_IDS),
  razon_template: z.string().describe("Una línea: por qué ese template para esta empresa y rol"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/* ---------- Generación (sólo redacción; los hechos se copian del perfil por código) ---------- */

export const GenerationSchema = z.object({
  titular: z.string().describe("Título profesional alineado al rol, honesto respecto de la trayectoria"),
  resumen: z.string().describe("3-4 líneas"),
  logros_clave: z.array(z.string()).describe("Los 3 logros más relevantes para esta vacante, una línea cada uno"),
  habilidades: z.array(z.string()).describe("8-14 habilidades, priorizando las palabras clave de la vacante con evidencia real"),
  experiencias: z
    .array(
      z.object({
        indice: z.number().describe("Índice de la experiencia en el perfil (0-based)"),
        incluir: z.boolean().describe("false para experiencias irrelevantes y antiguas que restan foco"),
        logros: z.array(z.string()).describe("2-5 bullets reescritos en formato acción + contexto + resultado"),
      }),
    )
    .describe("Una entrada por cada experiencia del perfil, en el mismo orden"),
  cambios_clave: z.array(z.string()).describe("Qué se ajustó y por qué, en lenguaje simple"),
  recomendaciones_formulario: z.array(
    z.object({
      campo: z.string(),
      respuesta_sugerida: z.string().describe("Texto listo para copiar y pegar"),
      por_que: z.string(),
      tip: z.string(),
    }),
  ),
});
export type Generation = z.infer<typeof GenerationSchema>;

export const BulletSchema = z.object({ texto: z.string() });

/* ---------- CV editable ---------- */

export type Item = { id: string; text: string };

export type CvExperience = {
  id: string;
  cargo: string;
  empresa: string;
  ubicacion: string;
  periodo: string;
  bullets: Item[];
};

export type CvEducation = { id: string; titulo: string; institucion: string; periodo: string };

export type SectionKey = "resumen" | "logrosClave" | "experiencia" | "educacion" | "habilidades" | "idiomas" | "certificaciones";

export type CvDoc = {
  template: TemplateId;
  lang: string;
  titulos: Record<SectionKey, string>;
  hidden: Partial<Record<SectionKey, boolean>>;
  photo: { dataUrl: string; shape: "circle" | "square" } | null;
  showPhoto: boolean;
  nombre: string;
  titular: string;
  contacto: { email: string; telefono: string; ubicacion: string; linkedin: string };
  resumen: string;
  logrosClave: Item[];
  experiencia: CvExperience[];
  educacion: CvEducation[];
  habilidades: string;
  idiomas: string;
  certificaciones: Item[];
};

/** Lo que el navegador envía para leer la vacante. */
export type JobInput = { jobUrl: string; jobText?: string };

export type CvSource = {
  kind: "linkedin" | "cv" | "texto";
  fileBase64?: string;
  mimeType?: string;
  text?: string;
};
