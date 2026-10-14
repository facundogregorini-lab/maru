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

/** Familias que la IA recomienda; cada una tiene varios templates en la galería. */
export const TEMPLATE_IDS = ["clasico", "moderno", "ejecutivo", "minimal"] as const;
export type BaseTemplateId = (typeof TEMPLATE_IDS)[number];
/** Cualquier template de la galería (ver components/cv/themes.ts). */
export type TemplateId = string;

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
export type Question = z.infer<typeof QuestionSchema>;

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

export type FontPairId = "sans" | "serif-clasica" | "serif" | "humanista";
export type Density = "compacto" | "normal" | "amplio";
export type TextSize = "chico" | "normal" | "grande";

/** Ajustes de diseño elegidos por la persona por encima del template. Todo opcional. */
export type CvStyle = {
  accent?: string;
  fonts?: FontPairId;
  density?: Density;
  size?: TextSize;
  order?: SectionKey[];
};

/** Lo que el CV necesita saber del objetivo, venga de una vacante o de la sección "Creá tu CV". */
export type CvContext = {
  puesto: string;
  idioma: string;
  pais: string;
  palabrasClave: string[];
  templateRecomendado: BaseTemplateId;
  razonTemplate: string;
};

export function contextFromAnalysis(a: Analysis): CvContext {
  return {
    puesto: a.puesto,
    idioma: a.idioma_vacante || "es",
    pais: a.pais_empresa,
    palabrasClave: a.palabras_clave_ats,
    templateRecomendado: a.template_recomendado,
    razonTemplate: a.razon_template,
  };
}

export type CvDoc = {
  template: TemplateId;
  style?: CvStyle;
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

/* ---------- Sección "Creá tu CV" (sin vacante: un objetivo profesional) ---------- */

export type Objetivo = {
  /** Rol al que apunta; vacío = que Maru lo deduzca de la trayectoria. */
  rol: string;
  nivel: string;
  industria: string;
  /** ISO-3166 alfa-2 del mercado donde busca, o "" (remoto / varios). */
  pais: string;
  idioma: "es" | "en" | "pt";
};

export const CvAnalysisSchema = z.object({
  rol_objetivo: z.string().describe("Nombre del rol objetivo, como lo publicaría una empresa en ese mercado e idioma"),
  idioma: z.string().describe("Código ISO del idioma del CV: el pedido por la persona"),
  pais: z.string().describe("ISO-3166 alfa-2 del mercado donde busca, o '' si es remoto o no se sabe"),
  resumen_objetivo: z.string().describe("2-3 frases: quién es la persona y hacia dónde apunta su CV"),
  palabras_clave_ats: z
    .array(z.string())
    .describe("12-20 términos exactos y cortos (1-3 palabras) que recruiters y ATS buscan para ese rol en ese mercado"),
  fortalezas: z.array(z.string()).describe("Lo que el perfil ya muestra bien para ese objetivo"),
  oportunidades: z.array(z.string()).describe("Lo que falta mostrar o está flojo para ese objetivo"),
  preguntas: z
    .array(QuestionSchema)
    .describe("Entre 3 y 5 preguntas para conseguir logros medibles y evidencia. No preguntes datos que ya están en el CV."),
  template_recomendado: z.enum(TEMPLATE_IDS),
  razon_template: z.string().describe("Una línea: por qué ese estilo para ese rol e industria"),
});
export type CvAnalysis = z.infer<typeof CvAnalysisSchema>;

export function contextFromCvAnalysis(a: CvAnalysis, objetivo: Objetivo): CvContext {
  return {
    puesto: a.rol_objetivo || objetivo.rol,
    idioma: objetivo.idioma || a.idioma || "es",
    pais: objetivo.pais || a.pais,
    palabrasClave: a.palabras_clave_ats,
    templateRecomendado: a.template_recomendado,
    razonTemplate: a.razon_template,
  };
}

export const CvGenerationSchema = GenerationSchema.omit({ recomendaciones_formulario: true }).extend({
  consejos: z.array(z.string()).describe("2-4 consejos concretos para seguir mejorando el CV o el perfil, en español"),
});
export type CvGeneration = z.infer<typeof CvGenerationSchema>;

/* ---------- Carta de presentación ---------- */

export type CartaTono = "calido" | "profesional" | "entusiasta" | "directo";
export type CartaLargo = "corta" | "media" | "completa";
export type CartaOpciones = { tono: CartaTono; largo: CartaLargo; idioma: "auto" | "es" | "en" | "pt"; destinatario: string };

export const CartaSchema = z.object({
  puesto: z.string(),
  empresa: z.string(),
  idioma: z.string().describe("Código ISO del idioma en que está escrita la carta"),
  saludo: z.string().describe("Saludo inicial, dirigido a la persona indicada si se conoce; si no, al equipo de la empresa"),
  parrafos: z.array(z.string()).describe("Cuerpo de la carta: 3 a 5 párrafos, sin saludo ni despedida"),
  cierre: z.string().describe("Fórmula de despedida antes de la firma, p. ej. 'Saludos cordiales,'"),
  asunto_email: z.string().describe("Asunto sugerido si la carta se envía por email"),
  mensaje_corto: z.string().describe("Versión breve (máximo 600 caracteres) para un mensaje de LinkedIn o un email corto al recruiter"),
  requisitos_cubiertos: z
    .array(z.object({ requisito: z.string(), como: z.string().describe("En una frase, cómo lo demuestra la carta") }))
    .describe("3-5 cosas que la empresa busca y la carta demuestra"),
  consejos: z.array(z.string()).describe("2-3 tips para enviarla o personalizarla más, en español"),
});
export type Carta = z.infer<typeof CartaSchema>;

export type CartaRemitente = { nombre: string; titular: string; email: string; telefono: string; ubicacion: string; linkedin: string };

/** La carta editable. Comparte templates y ajustes de diseño con el CV. */
export type CartaDoc = {
  template: TemplateId;
  style?: CvStyle;
  lang: string;
  remitente: CartaRemitente;
  fecha: string;
  saludo: string;
  parrafos: Item[];
  cierre: string;
  firma: string;
};

/* ---------- Video de presentación y entrevista: objetivo compartido ---------- */

/** Búsqueda concreta (link/texto) o un rol en general. */
export type TargetInput = { job?: JobInput; general?: { rol: string; empresa: string } };

/* ---------- Video de presentación ---------- */

export type VideoOpciones = { duracion: 30 | 60 | 90; tono: "calido" | "profesional" | "energico"; idioma: "auto" | "es" | "en" | "pt" };

export const VideoGuionSchema = z.object({
  titulo: z.string().describe("Para qué es el video, en pocas palabras (ej.: 'Product Manager en Mercado Pago')"),
  idioma: z.string().describe("Código ISO del idioma del guion"),
  bloques: z
    .array(
      z.object({
        nombre: z.string().describe("Etapa: Gancho, Quién sos, Por qué vos, Una prueba, Cierre…"),
        texto: z.string().describe("Lo que la persona dice, en primera persona, oral y natural"),
        segundos: z.number().describe("Duración estimada del bloque"),
        tip: z.string().describe("Cómo decirlo: gesto, pausa, énfasis. Una línea."),
      }),
    )
    .describe("4 o 5 bloques que suman la duración pedida"),
  consejos: z.array(z.string()).describe("4-6 consejos concretos de grabación: encuadre, luz, sonido, ropa, energía"),
  mensaje_envio: z.string().describe("Mensaje corto para mandar junto con el link del video (email o LinkedIn), en el idioma del guion"),
});
export type VideoGuion = z.infer<typeof VideoGuionSchema>;

export const VideoFeedbackSchema = z.object({
  puntaje: z.number().describe("De 1 a 10"),
  resumen: z.string().describe("2 frases cálidas y honestas"),
  fortalezas: z.array(z.string()),
  mejoras: z.array(z.object({ aspecto: z.string(), detalle: z.string(), como: z.string().describe("Qué hacer distinto en la próxima toma") })),
  imagen: z
    .object({ encuadre: z.string(), luz: z.string(), fondo: z.string(), mirada: z.string() })
    .describe("Comentarios sobre los fotogramas; si no hay fotogramas, strings vacíos"),
  ritmo: z.string().describe("Sobre velocidad, pausas y muletillas"),
  guion: z.string().describe("Qué tan fiel fue al guion y si conviene ajustar algo del texto"),
});
export type VideoFeedback = z.infer<typeof VideoFeedbackSchema>;

/* ---------- Entrená para tu entrevista ---------- */

export type EntrevistaOpciones = {
  tipo: "rrhh" | "hiring" | "tecnica";
  dificultad: "amable" | "estandar" | "exigente";
  preguntas: 4 | 6 | 8;
  idioma: "auto" | "es" | "en" | "pt";
};

export const EntrevistaPlanSchema = z.object({
  entrevistador: z.object({ nombre: z.string().describe("Nombre de pila verosímil para el país"), cargo: z.string() }),
  empresa: z.string().describe("Empresa de la búsqueda, o '' si es general"),
  puesto: z.string(),
  idioma: z.string().describe("Código ISO del idioma de la entrevista"),
  contexto_puesto: z.string().describe("Qué buscan, en 80-120 palabras, para usar en las repreguntas"),
  contexto_candidato: z.string().describe("Resumen fiel del CV en 100-150 palabras: cargos, empresas, logros. Sin inventar."),
  apertura: z.string().describe("Saludo breve y natural, cómo va a ser la entrevista (1-3 frases). No incluye la primera pregunta."),
  preguntas: z
    .array(z.object({ tema: z.string(), pregunta: z.string().describe("Tal como la diría en voz alta"), que_evalua: z.string() }))
    .describe("Exactamente la cantidad pedida, de lo general a lo específico"),
  cierre: z.string().describe("Despedida natural, con próximos pasos genéricos (1-2 frases)"),
});
export type EntrevistaPlan = z.infer<typeof EntrevistaPlanSchema>;

export type Intercambio = { pregunta: string; respuesta: string; segundos: number; repregunta?: boolean };

export const TurnoSchema = z.object({
  reaccion: z.string().describe("Reacción breve y natural a la respuesta (máx. 1 frase), sin evaluarla ni elogiar de más"),
  repregunta: z.string().describe("Una repregunta concreta si la respuesta quedó vaga o sin ejemplo; '' si no hace falta"),
});
export type Turno = z.infer<typeof TurnoSchema>;

export const InformeSchema = z.object({
  puntaje: z.number().describe("0 a 100"),
  veredicto: z.string().describe("Una frase: qué tan lista está la persona para la entrevista real"),
  resumen: z.string().describe("2-3 frases cálidas y honestas"),
  fortalezas: z.array(z.string()),
  a_mejorar: z.array(z.string()),
  respuestas: z.array(
    z.object({
      pregunta: z.string(),
      puntaje: z.number().describe("1 a 5"),
      funciono: z.string(),
      mejorar: z.string(),
      respuesta_sugerida: z
        .string()
        .describe("Cómo podría responder mejor, en primera persona y con estructura STAR cuando aplica, usando sólo hechos reales de su CV y sus respuestas"),
    }),
  ),
  proximos_pasos: z.array(z.string()).describe("2-4 acciones concretas para practicar antes de la entrevista real"),
});
export type Informe = z.infer<typeof InformeSchema>;
