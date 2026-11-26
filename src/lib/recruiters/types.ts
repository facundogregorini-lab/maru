import { z } from "zod";

/**
 * Maru Recruiters: búsquedas de candidatos para empresas (docs/RECRUITERS.md).
 * Una búsqueda tiene un perfil ideal (ICP) versionado, candidatos y las decisiones del reclutador.
 */

export const PESOS = ["excluyente", "importante"] as const;
export type Peso = (typeof PESOS)[number];
export const ORIGENES = ["brief", "aviso", "referencia", "ajuste", "manual"] as const;
export type Origen = (typeof ORIGENES)[number];
export const DECISIONES = ["si", "tal", "no"] as const;
export type Decision = (typeof DECISIONES)[number];
export const ESTADOS = ["cumple", "no_cumple", "sin_datos"] as const;
export type Estado = (typeof ESTADOS)[number];
export const CATEGORIAS = ["fuerte", "bueno", "parcial", "bajo", "inconcluso"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export const FUENTES = ["propio", "maru"] as const;
export type Fuente = (typeof FUENTES)[number];

/** Límites de texto y cantidad: protegen la base y el costo de la IA. */
export const LIMITS = {
  brief: 4000,
  aviso: 20000,
  criterio: 300,
  obligatorios: 8,
  deseables: 8,
  evitar: 6,
  referencias: 10,
  candidatos: 300,
  motivo: 300,
  busquedasPorCuenta: 50,
} as const;

const texto = (max: number) => z.string().trim().min(1).max(max);

export const CriterioSchema = z.object({ id: z.string().min(1).max(40), texto: texto(LIMITS.criterio), peso: z.enum(PESOS), origen: z.enum(ORIGENES) });
export type Criterio = z.infer<typeof CriterioSchema>;
export const ItemSchema = z.object({ id: z.string().min(1).max(40), texto: texto(LIMITS.criterio) });
export type Item = z.infer<typeof ItemSchema>;

export const IcpSchema = z.object({
  version: z.number().int().min(1),
  puesto: z.string().trim().max(200),
  resumen: z.string().trim().max(600),
  obligatorios: z.array(CriterioSchema).max(LIMITS.obligatorios),
  deseables: z.array(ItemSchema).max(LIMITS.deseables),
  evitar: z.array(ItemSchema).max(LIMITS.evitar),
  referencias: z.array(z.string().trim().min(1).max(80)).max(LIMITS.referencias),
  seniority: z.string().trim().max(120),
  ubicacion: z.string().trim().max(200),
  creadoEn: z.number(),
});
export type Icp = z.infer<typeof IcpSchema>;

/** Lo que el reclutador puede editar del perfil ideal (el resto lo pone el servidor). */
export const IcpEditSchema = IcpSchema.omit({ version: true, creadoEn: true });
export type IcpEdit = z.infer<typeof IcpEditSchema>;

export type Pregunta = { id: string; texto: string; opciones: string[] };

export type Busqueda = {
  id: string;
  /** Hash del email del dueño (src/lib/sync/server.ts). */
  owner: string;
  titulo: string;
  brief: string;
  aviso: string;
  /** Historial completo: la última es la vigente. */
  icps: Icp[];
  /** true mientras el reclutador no aprobó la versión vigente (la primera, o una editada a mano). */
  borrador: boolean;
  preguntas: Pregunta[];
  fuentes: { propios: boolean; maru: boolean };
  /** Ajustes que propuso la IA y esperan respuesta (se reemplazan en cada pedido). */
  propuestas: Propuesta[];
  creadaEn: number;
  actualizadaEn: number;
};

export type EvalCriterio = { id: string; estado: Estado; evidencia: string };
export type Evaluacion = {
  icpVersion: number;
  categoria: Categoria;
  porQue: string;
  criterios: EvalCriterio[];
  deseables: { id: string; estado: Estado }[];
  alertas: string[];
  evaluadoEn: number;
};

export type Candidato = {
  id: string;
  busquedaId: string;
  fuente: Fuente;
  nombre: string;
  titular: string;
  ubicacion: string;
  /** Experiencia, estudios y aptitudes como texto, sin datos de contacto: es lo que lee la IA. */
  perfil: string;
  /** Sólo de los CVs que subió el reclutador. Los candidatos de Maru comparten el contacto cuando aceptan. */
  contacto: { email: string; telefono: string; linkedin: string };
  /** Id de la cuenta en el índice de talento (fuente "maru"). */
  talentoId?: string;
  evaluacion: Evaluacion | null;
  decision: Decision | null;
  motivo: string;
  decididoEn: number | null;
  /** Versión del perfil ideal con la que decidió (para comparar versiones). */
  decididoConVersion: number | null;
  agregadoEn: number;
};

export const PROPUESTA_TIPOS = ["agregar_obligatorio", "quitar_obligatorio", "cambiar_peso", "editar_obligatorio", "agregar_deseable", "agregar_evitar"] as const;
export type PropuestaTipo = (typeof PROPUESTA_TIPOS)[number];
export type Propuesta = { id: string; tipo: PropuestaTipo; criterioId: string; antes: string; despues: string; peso: Peso | null; porQue: string };

/* ---------- Pedidos a la API ---------- */

export const CvSourceSchema = z.object({
  kind: z.enum(["linkedin", "cv", "texto"]),
  fileBase64: z.string().max(14_000_000).optional(),
  mimeType: z.string().max(120).optional(),
  text: z.string().max(60_000).optional(),
});

export const CrearBusquedaSchema = z.object({
  brief: z.string().trim().min(20).max(LIMITS.brief),
  jobUrl: z.string().trim().max(2000).optional(),
  jobText: z.string().trim().max(LIMITS.aviso).optional(),
  referencia: CvSourceSchema.optional(),
  fuentes: z.object({ propios: z.boolean(), maru: z.boolean() }).optional(),
});

export const AccionSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("editar_icp"), icp: IcpEditSchema }),
  z.object({ accion: z.literal("responder"), preguntaId: z.string().max(40), respuesta: z.string().trim().min(1).max(300) }),
  z.object({ accion: z.literal("aprobar") }),
  z.object({ accion: z.literal("agregar_cv"), source: CvSourceSchema }),
  z.object({ accion: z.literal("evaluar"), max: z.number().int().min(1).max(5).optional() }),
  z.object({ accion: z.literal("calificar"), candidatoId: z.string().max(40), decision: z.enum(DECISIONES).nullable(), motivo: z.string().trim().max(LIMITS.motivo).optional() }),
  z.object({ accion: z.literal("proponer") }),
  z.object({ accion: z.literal("aplicar"), aceptadas: z.array(z.string().max(40)).max(8) }),
  z.object({ accion: z.literal("borrar_candidato"), candidatoId: z.string().max(40) }),
  z.object({ accion: z.literal("buscar_maru") }),
]);
export type Accion = z.infer<typeof AccionSchema>;

/* ---------- Salidas de la IA (salida estructurada) ---------- */

export const IcpDraftSchema = z.object({
  titulo: z.string().describe("Nombre corto de la búsqueda, por ejemplo 'Head of Growth · Fintech de pagos'"),
  puesto: z.string().describe("El puesto tal como lo nombra el brief o el aviso"),
  resumen: z.string().describe("Una o dos oraciones sobre el perfil que se busca, en menos de 40 palabras"),
  obligatorios: z
    .array(z.object({ texto: z.string().describe("Criterio verificable en un CV, en menos de 15 palabras"), peso: z.enum(PESOS), origen: z.enum(["brief", "aviso", "referencia"]) }))
    .describe("Entre 3 y 6 requisitos"),
  deseables: z.array(z.object({ texto: z.string() })).describe("Hasta 5"),
  evitar: z.array(z.object({ texto: z.string() })).describe("Perfiles que no sirven aunque se parezcan. Hasta 3; vacío si el brief no da pistas"),
  referencias: z.array(z.string()).describe("Industrias o tipos de empresa de donde conviene que venga la persona. Hasta 6"),
  seniority: z.string().describe("Nivel buscado en pocas palabras, o '' si no surge"),
  ubicacion: z.string().describe("Ubicación y modalidad pedidas, o '' si no surgen"),
  preguntas: z
    .array(z.object({ texto: z.string().describe("Pregunta al reclutador, en menos de 25 palabras"), opciones: z.array(z.string()).describe("Dos o tres respuestas cortas posibles") }))
    .describe("Hasta 2 dudas que cambian mucho los resultados. Vacío si el brief es claro"),
});
export type IcpDraft = z.infer<typeof IcpDraftSchema>;

export const EvalDraftSchema = z.object({
  criterios: z.array(z.object({ id: z.string(), estado: z.enum(ESTADOS), evidencia: z.string().describe("Dato o cita breve del perfil que lo muestra, en menos de 20 palabras. Si no hay, qué falta") })),
  deseables: z.array(z.object({ id: z.string(), estado: z.enum(ESTADOS) })),
  evitar: z.array(z.object({ id: z.string(), coincide: z.boolean() })),
  por_que: z.string().describe("Por qué apareció este perfil y qué le falta, en una o dos oraciones, menos de 35 palabras"),
  alertas: z.array(z.string()).describe("Inconsistencias del propio perfil (fechas imposibles, texto genérico de plantilla). Vacío si no hay"),
});
export type EvalDraft = z.infer<typeof EvalDraftSchema>;

export const PropuestasDraftSchema = z.object({
  propuestas: z
    .array(
      z.object({
        tipo: z.enum(PROPUESTA_TIPOS),
        criterio_id: z.string().describe("Id del criterio que cambia, o '' si es nuevo"),
        antes: z.string().describe("Cómo está hoy, o '' si es nuevo"),
        despues: z.string().describe("Cómo quedaría. Para quitar, ''"),
        peso: z.enum(["excluyente", "importante", "ninguno"]),
        por_que: z.string().describe("Qué calificaciones y motivos lo justifican, nombrando a los candidatos, en menos de 35 palabras"),
      }),
    )
    .describe("Entre 1 y 4 ajustes. Vacío si las calificaciones no muestran un patrón"),
});
export type PropuestasDraft = z.infer<typeof PropuestasDraftSchema>;
