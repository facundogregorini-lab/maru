/**
 * Modelo de datos de "Encontrá tu trabajo perfecto".
 *
 * Separación pedida por producto:
 * - Opportunity: la oportunidad canónica (un puesto real), compartida por todos los usuarios.
 * - Posting: cada publicación de esa oportunidad en una fuente (ATS del empleador, portal, feed).
 * - MatchProfile / MatchPrefs / Interactions: datos personales, viven sólo en el navegador del usuario.
 * - SyncRun: cada ejecución de sincronización.
 *
 * Este módulo no depende de Next ni de librerías externas: lo usan las rutas de la app,
 * el script de sincronización (scripts/match-sync.ts) y los tests.
 */

export type SourceKind = "ats" | "portal";

/** Estado de una fuente según su revisión de condiciones y disponibilidad. */
export type SourceStatus = "habilitada" | "necesita_credencial" | "necesita_autorizacion" | "incompatible" | "fallida";

export type Eligibility = "elegible" | "por_confirmar" | "no_elegible";

export type Workplace = "remoto" | "hibrido" | "presencial" | "desconocido";

export type Seniority = "pasantia" | "junior" | "semi_senior" | "senior" | "lead" | "manager" | "director" | "ejecutivo";

export const SENIORITY_ORDER: Seniority[] = ["pasantia", "junior", "semi_senior", "senior", "lead", "manager", "director", "ejecutivo"];

export type EmploymentType = "full_time" | "part_time" | "contrato" | "freelance" | "pasantia" | "temporal";

export type RoleFamily =
  | "software"
  | "datos"
  | "producto"
  | "diseno"
  | "marketing"
  | "ventas"
  | "atencion_cliente"
  | "operaciones"
  | "finanzas"
  | "rrhh"
  | "legal"
  | "administracion"
  | "logistica"
  | "salud"
  | "educacion"
  | "consultoria"
  | "produccion"
  | "gastronomia"
  | "comercio"
  | "seguridad"
  | "entrenamiento_ia"
  | "otros";

/** De dónde salió cada dato: así podemos explicar y auditar sin inventar. */
export type Provenance = "fuente" | "titulo" | "descripcion" | "ia" | "usuario";

export type Field<T> = { value: T; from: Provenance; evidence?: string };

export type Salary = {
  min: number | null;
  max: number | null;
  currency: string;
  period: "hora" | "mes" | "anio" | "desconocido";
  /** Texto tal como lo publica la fuente, si no viene estructurado. */
  text?: string;
};

export type LanguageReq = { language: string; level: string; required: boolean };

/** Lo que devuelve un conector después de normalizar un aviso. */
export type NormalizedPosting = {
  sourceId: string; // "greenhouse", "lever", "remotive"…
  boardId: string; // "greenhouse:clara" o "remotive"
  externalId: string; // id original en la fuente
  title: string;
  company: string;
  companySlug?: string;
  sourceUrl: string; // URL del aviso en la fuente
  applyUrl: string; // URL de postulación que exige/ofrece la fuente
  /** true si la fuente obliga a usar sus enlaces (atribución). No se reemplazan por el ATS. */
  linkRequired: boolean;
  attribution?: string;
  descriptionText: string;
  descriptionComplete: boolean; // false si la fuente sólo da un extracto
  locations: string[];
  countries: string[]; // ISO-2 cuando la fuente los informa; vacío = desconocido
  /** Regiones declaradas por la fuente ("LATAM", "Worldwide", "USA Only"…), tal cual. */
  regionText: string[];
  workplace: Field<Workplace>;
  remoteFlag: boolean | null;
  employmentType: Field<EmploymentType> | null;
  department?: string;
  salary: Field<Salary> | null;
  publishedAt: string | null; // ISO; null si la fuente no lo da
  updatedAt: string | null;
  expiresAt: string | null;
  sourceLanguage?: string;
  /** Texto de la fuente sobre jornada/contrato ("Full-time", "Contract"…), para extraer el tipo. */
  employmentHint?: string;
  /** Seniority tal como la publica la fuente, si la informa. */
  seniorityHint?: string;
  /** Logo de la empresa (https) tal como lo informa la fuente; la tarjeta cae a la inicial si no carga. */
  companyLogo?: string;
  /** Antigüedad relativa tal como la publica la fuente ("hace 3 días") cuando no hay fecha exacta. */
  postedLabel?: string;
};

export type EligibilityResult = {
  status: Eligibility;
  /** Frases concretas del aviso que justifican la clasificación. */
  evidence: string[];
  /** Restricción horaria detectada (no implica permiso de contratación). */
  timezone?: string;
};

export type Extracted = {
  family: Field<RoleFamily>;
  seniority: Field<Seniority> | null;
  employmentType: Field<EmploymentType> | null;
  languages: LanguageReq[];
  skillsRequired: string[];
  skillsDesirable: string[];
  skillsMentioned: string[];
  yearsRequired: number | null;
};

export type PostingStatus = "abierta" | "cerrada";

/** Una publicación concreta, guardada en el inventario. */
export type StoredPosting = NormalizedPosting & {
  key: string; // `${boardId}:${externalId}`
  contentHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  /** Última vez que la fuente primaria (ATS del empleador) confirmó el aviso. */
  lastVerifiedAt: string | null;
  missedCompleteSyncs: number;
  status: PostingStatus;
  closedReason?: string;
  closedAt?: string;
  /** Última vez que se miró la página original de un aviso importado (liveness.ts). */
  lastLiveCheckAt?: string;
  /** Resultado de esa revisión: "desconocido" = la fuente no respondió o bloqueó al bot. */
  lastLiveResult?: "abierta" | "cerrada" | "desconocido";
  /** Calculados al recibir el aviso completo (después se puede recortar la descripción). */
  eligibility: EligibilityResult;
  extracted: Extracted;
};

/** Oportunidad canónica: un puesto, con todas sus publicaciones. */
export type Opportunity = {
  id: string;
  title: string;
  company: string;
  postingKeys: string[];
  locations: string[];
  countries: string[];
  workplace: Field<Workplace>;
  eligibility: EligibilityResult;
  extracted: Extracted;
  salary: Field<Salary> | null;
  /** Publicación principal: la del empleador si existe, si no la más antigua. */
  primaryKey: string;
  descriptionComplete: boolean;
  publishedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  status: PostingStatus;
  contentHash: string;
};

export type BoardSyncResult = {
  boardId: string;
  ok: boolean;
  /** Si recibimos el listado entero (todas las páginas). Sólo una sync completa cuenta ausencias. */
  complete: boolean;
  received: number;
  error?: string;
  httpStatus?: number;
  durationMs: number;
};

export type SyncRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  mode: "inicial" | "incremental";
  boards: BoardSyncResult[];
  created: number;
  updated: number;
  unchanged: number;
  closed: number;
  errors: number;
};

/** Estado de cada bolsa (empresa o portal) según las últimas sincronizaciones. */
export type BoardState = {
  boardId: string;
  sourceId: string;
  company?: string;
  lastAttemptAt: string | null;
  lastOkAt: string | null;
  lastError: string | null;
  lastHttpStatus?: number;
  consecutiveFailures: number;
  lastReceived: number;
};

export type Inventory = {
  version: 1;
  generatedAt: string | null;
  /** Fixture o real: nunca mezclamos datos de prueba con el inventario real. */
  kind: "real" | "fixture";
  opportunities: Opportunity[];
  postings: StoredPosting[];
  runs: SyncRun[];
  boards: Record<string, BoardState>;
};

/* ---------- Datos del usuario (sólo en su navegador) ---------- */

export type MatchProfile = {
  headline: string;
  titles: string[]; // cargos recientes primero
  skills: string[];
  languages: { language: string; level: string }[];
  yearsExperience: number | null;
  location: string;
  summary: string;
};

export type Hardable = "modalidad" | "ubicacion" | "seniority" | "contrato" | "salario" | "idioma";

export type MatchPrefs = {
  objetivo: string;
  rolesDeseados: string[];
  evitar: string[];
  ciudad: string;
  pais: string;
  /** Otros lugares donde aceptaría trabajar presencial o híbrido (ciudades o países). */
  otrosLugares: string[];
  /** Países o regiones donde declaró poder trabajar legalmente además de Argentina (opcional). */
  autorizacion: string[];
  modalidades: Workplace[];
  seniorities: Seniority[];
  contratos: EmploymentType[];
  salario: { monto: number | null; moneda: "ARS" | "USD" | "EUR"; periodo: "mes" | "anio"; tipo: "bruto" | "neto" } | null;
  indispensables: Hardable[];
  carrera: "continuidad" | "cambio" | "ambas";
};

export type DiscardReason = "rol" | "seniority" | "ubicacion" | "empresa" | "salario" | "otro";

export type Interactions = {
  saved: string[]; // ids de oportunidad
  discarded: { id: string; reason: DiscardReason; family?: RoleFamily; company?: string; titleTokens?: string[] }[];
};
