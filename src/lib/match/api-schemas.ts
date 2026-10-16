import { z } from "zod";

/** Validación de lo que el navegador manda al ranking. Límites estrictos: es dato no confiable. */

const str = (max: number) => z.string().max(max);
const list = (max: number, len = 120) => z.array(str(len)).max(max);

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
  "otros",
] as const;

export const MatchProfileSchema = z.object({
  headline: str(200),
  titles: list(10, 160),
  skills: list(60, 80),
  languages: z.array(z.object({ language: str(40), level: str(60) })).max(10),
  yearsExperience: z.number().min(0).max(70).nullable(),
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
