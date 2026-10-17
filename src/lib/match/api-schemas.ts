import { z } from "zod";

/**
 * Validación de lo que el navegador manda al ranking: es dato no confiable.
 * El texto libre (lo que sale del CV o escribe la persona) se recorta en vez de rechazarse:
 * una aptitud larga no puede dejar a nadie sin ranking. El tamaño total ya lo acota la ruta.
 */

const str = (max: number) => z.string().transform((s) => s.trim().slice(0, max));
const list = (max: number, len = 120) => z.array(z.string()).transform((xs) => xs.map((s) => s.trim().slice(0, len)).filter(Boolean).slice(0, max));

const WORKPLACES = ["remoto", "hibrido", "presencial", "desconocido"] as const;
const SENIORITIES = ["pasantia", "junior", "semi_senior", "senior", "lead", "manager", "director", "ejecutivo"] as const;
const CONTRACTS = ["full_time", "part_time", "contrato", "freelance", "pasantia", "temporal"] as const;
const FAMILIES = [
  "software",
  "datos",
  "producto",
  "diseno",
  "marketing",
  "ventas",
  "atencion_cliente",
  "operaciones",
  "finanzas",
  "rrhh",
  "legal",
  "administracion",
  "logistica",
  "salud",
  "educacion",
  "consultoria",
  "produccion",
  "gastronomia",
  "comercio",
  "seguridad",
  "entrenamiento_ia",
  "otros",
] as const;

export const MatchProfileSchema = z.object({
  headline: str(200),
  titles: list(10, 160),
  skills: list(60, 80),
  languages: z
    .array(z.object({ language: str(40), level: str(60) }))
    .transform((xs) => xs.filter((l) => l.language).slice(0, 10)),
  yearsExperience: z
    .number()
    .nullable()
    .transform((n) => (n === null ? null : Math.min(70, Math.max(0, n)))),
  location: str(160),
  summary: str(1000),
});

export const MatchPrefsSchema = z.object({
  objetivo: str(600),
  rolesDeseados: list(8),
  evitar: list(10),
  ciudad: str(120),
  pais: str(80),
  otrosLugares: list(8),
  autorizacion: list(8, 60),
  modalidades: z.array(z.enum(WORKPLACES)).max(4),
  seniorities: z.array(z.enum(SENIORITIES)).max(8),
  contratos: z.array(z.enum(CONTRACTS)).max(6),
  salario: z
    .object({
      monto: z.number().min(0).max(1e9).nullable(),
      moneda: z.enum(["ARS", "USD", "EUR"]),
      periodo: z.enum(["mes", "anio"]),
      tipo: z.enum(["bruto", "neto"]),
    })
    .nullable(),
  indispensables: z.array(z.enum(["modalidad", "ubicacion", "seniority", "contrato", "salario", "idioma"])).max(6),
  carrera: z.enum(["continuidad", "cambio", "ambas"]),
});

export const InteractionsSchema = z.object({
  saved: z.array(str(40)).max(500),
  discarded: z
    .array(
      z.object({
        id: str(40),
        reason: z.enum(["rol", "seniority", "ubicacion", "empresa", "salario", "otro"]),
        family: z.enum(FAMILIES).optional(),
        company: str(120).optional(),
        titleTokens: list(20, 40).optional(),
      }),
    )
    .max(1000),
});

export const FiltersSchema = z
  .object({
    families: z.array(z.enum(FAMILIES)).max(17).optional(),
    location: str(120).optional(),
    workplaces: z.array(z.enum(WORKPLACES)).max(4).optional(),
    seniorities: z.array(z.enum(SENIORITIES)).max(8).optional(),
    language: z.enum(["sin_ingles", "con_ingles"]).optional(),
    maxAgeDays: z.number().int().min(1).max(365).optional(),
    salaryPublished: z.boolean().optional(),
  })
  .optional();

/** Búsqueda agregada a mano por la persona: privada, viaja desde su navegador en cada consulta. */
export const ExternalJobSchema = z.object({
  id: str(40),
  title: str(200),
  company: str(120),
  url: str(600),
  text: str(12000),
  location: str(160),
  addedAt: str(40),
});

export const RankingRequestSchema = z.object({
  profile: MatchProfileSchema,
  prefs: MatchPrefsSchema,
  interactions: InteractionsSchema,
  filters: FiltersSchema,
  external: z.array(ExternalJobSchema).max(30).optional(),
  /** Cuántas mostrar por lista ("Ver más" suma de a 40). */
  limit: z.number().int().min(10).max(400).optional(),
});

export type ExternalJob = z.infer<typeof ExternalJobSchema>;

const FIELD_LABEL: Record<string, string> = {
  headline: "titular",
  titles: "cargos",
  skills: "habilidades",
  languages: "idiomas",
  yearsExperience: "años de experiencia",
  location: "dónde vivís",
  objetivo: "qué te gustaría hacer",
  rolesDeseados: "roles deseados",
  evitar: "roles a evitar",
  ciudad: "ciudad",
  pais: "país",
  otrosLugares: "otros lugares",
  autorizacion: "autorización de trabajo",
  modalidades: "modalidad",
  seniorities: "seniority",
  contratos: "tipo de contrato",
  salario: "salario",
  indispensables: "indispensables",
  carrera: "continuidad o cambio",
};

/** Qué campos fallaron, en palabras de la persona (sin repetir lo que mandó: puede ser dato personal). */
export function invalidFields(error: z.ZodError): string[] {
  const names = error.issues.map((i) => {
    const key = [...i.path].reverse().find((k): k is string => typeof k === "string" && k in FIELD_LABEL);
    return key ? FIELD_LABEL[key] : String(i.path[0] ?? "pedido");
  });
  return [...new Set(names)];
}
