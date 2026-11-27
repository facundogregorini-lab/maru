/**
 * Modelo de datos de Radar laboral (esquema v1, ver docs/radar/ADR-001-persistencia.md).
 * Catálogo y fuentes son globales; seguimiento, ajustes, vacantes del piloto e importaciones son de cada persona.
 */

export type Priority = "P1" | "P2" | "P3";
export const PRIORITIES: readonly Priority[] = ["P1", "P2", "P3"];

/** Cómo se identificó la empresa: por dominio (declarado en una fuente) o por un slug del nombre (provisoria). */
export type IdentityKind = "dominio" | "provisoria";

export type Company = {
  /** `d:<dominio>` o `s:<slug>`. */
  id: string;
  identity: IdentityKind;
  canonicalDomain: string | null;
  /** false hasta que la sesión de fuentes compruebe el dominio. */
  domainVerified: boolean;
  slug: string;
  name: string;
  aliases: string[];
  description: string;
  headquarters: string;
  stage: string;
  employeeBand: string;
  /** Áreas laborales sugeridas en el Sheet. */
  suggestedAreas: string[];
  /** Etiquetas sectoriales del catálogo (IA, Space, Tech Startups…). */
  industries: string[];
  /** LatAm, Global o vacío si no se sabe. */
  region: string;
  /** Ranking regional por sector, tal como venía en el Sheet. */
  rankings: { industry: string; region: string; rank: string }[];
  /** Referencias de las fuentes del Sheet (texto o links). */
  references: string[];
  /** De dónde salieron los metadatos y cuándo. */
  metadataSource: { label: string; at: string } | null;
  createdAt: string;
  updatedAt: string;
};

/** careers = página propia sin ATS reconocido (todavía sin resolver); jsonld = la página publica JobPosting. */
export type SourceProvider = "greenhouse" | "lever" | "ashby" | "jsonld" | "careers";
/**
 * pending: registrada, sin revisar. success: snapshot completo con vacantes. verified_empty: completo y sin vacantes.
 * partial: se leyó, pero incompleto o sospechoso (nunca cierra vacantes). error: falló la última vez. manual: no se puede leer sola.
 */
export type SourceStatus = "pending" | "success" | "verified_empty" | "partial" | "error" | "manual";
export const SOURCE_STATUSES: readonly SourceStatus[] = ["pending", "success", "verified_empty", "partial", "error", "manual"];

export type CompanySource = {
  id: string;
  companyId: string;
  provider: SourceProvider;
  careersUrl: string;
  externalBoardId: string | null;
  /** Región del ATS (Greenhouse y Lever tienen instancia EU). */
  region?: "us" | "eu";
  /** URL que se lee para JSON-LD (después de redirecciones). */
  resolvedUrl?: string | null;
  status: SourceStatus;
  /** Motivo corto del estado (sanitizado, sin datos de personas). */
  statusNote?: string;
  /** "Estado del enlace" del Sheet, tal cual. */
  declaredStatus: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  /** Última resolución de ATS/board. */
  resolvedAt?: string | null;
  nextDueAt: string | null;
  failureCount: number;
  /** Vacantes abiertas según la última lectura (para la tabla, sin leer el índice). */
  openJobs?: number;
  createdAt: string;
};

export type TargetStatus = "activa" | "archivada";

export type TargetCompany = {
  companyId: string;
  /** null = por clasificar. */
  priority: Priority | null;
  /** Orden manual dentro de la prioridad (menor primero). */
  position: number;
  notes: string;
  status: TargetStatus;
  /** Etiquetas personales (además de las del catálogo). */
  tags: string[];
  origin: "importacion" | "manual" | "catalogo";
  createdAt: string;
  updatedAt: string;
};

export type TargetsDoc = { items: Record<string, TargetCompany>; updatedAt: number };

export type Frequency = "diaria" | "semanal" | "mensual" | "pausada";
export const FREQUENCIES: readonly Frequency[] = ["diaria", "semanal", "mensual", "pausada"];

export type MatchWeights = {
  experiencia: number;
  seniority: number;
  ubicacion: number;
  compensacion: number;
  interes: number;
};

export type RadarSettings = {
  enabled: boolean;
  frequencies: Record<Priority, Frequency>;
  timezone: string;
  digest: { enabled: boolean; day: number; time: string };
  instantAlerts: { enabled: boolean; threshold: number };
  channels: { inApp: boolean; email: boolean };
  weights: MatchWeights;
  updatedAt: string | null;
};

/** Vacante histórica del piloto (sección JOB OPENINGS · PILOTO). Sin vigencia verificada. */
export type PilotJob = {
  id: string;
  companyId: string | null;
  company: string;
  title: string;
  location: string;
  priority: string;
  /** Score editorial del Sheet. No es el match de Radar ni una probabilidad. */
  editorialScore: number | null;
  fsgp: string;
  reasons: string;
  barriers: string;
  url: string;
  evidence: string;
  date: string;
  action: string;
  industry: string;
  importedAt: string;
};

export type ImportRun = {
  id: string;
  at: string;
  fileName: string;
  companiesCreated: number;
  companiesUpdated: number;
  targetsCreated: number;
  targetsKept: number;
  pilotJobs: number;
  ignoredRows: number;
  errors: number;
};

/** Una fila de "Mis empresas": el seguimiento con su empresa y fuentes. */
export type TargetView = { target: TargetCompany; company: Company; sources: CompanySource[] };

/* ---------- Vacantes detectadas (globales por fuente) ---------- */

export type RemoteType = "remoto" | "hibrido" | "presencial" | "desconocido";
export type JobStatus = "open" | "closed";
export type JobEvent = { at: string; event: "opened" | "modified" | "closed" | "reopened"; reason?: string };

export type JobOpening = {
  /** `${sourceId}:${externalJobId}` (hash corto). */
  id: string;
  companyId: string;
  sourceId: string;
  externalJobId: string;
  /** Link oficial del aviso, tal cual (https). */
  url: string;
  /** Para detectar el mismo aviso en otra fuente (minúsculas, sin utm). */
  canonicalUrl: string;
  title: string;
  location: string;
  remoteType: RemoteType;
  department: string;
  contentHash: string;
  /** Fecha que publica la fuente; null si no la da. No es la primera detección. */
  publishedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  status: JobStatus;
  closedAt: string | null;
  closedReason: string | null;
  /** Snapshots completos y exitosos seguidos sin esta vacante. */
  missedCompleteSnapshots: number;
  history: JobEvent[];
};

/** Índice de vacantes de una fuente (sin descripciones; esas van aparte). */
export type SourceJobsDoc = {
  sourceId: string;
  jobs: Record<string, JobOpening>;
  updatedAt: number;
  /** Caída brusca vista una vez: si la próxima lectura completa la repite, se da por confirmada. */
  pendingDrop?: { count: number; at: string } | null;
};

export type RunTrigger = "manual" | "script" | "worker";
export type RunItemStatus = SourceStatus | "skipped" | "locked";

export type MonitoringRunItem = {
  sourceId: string;
  companyId: string;
  provider: SourceProvider;
  attempts: number;
  status: RunItemStatus;
  /** true si el snapshot vino entero (todas las páginas). */
  complete: boolean;
  received: number;
  created: number;
  modified: number;
  closed: number;
  reopened: number;
  error: string | null;
  durationMs: number;
};

export type MonitoringRun = {
  id: string;
  trigger: RunTrigger;
  startedAt: string;
  finishedAt: string | null;
  status: "completa" | "parcial" | "con_errores";
  budgetMs: number;
  items: MonitoringRunItem[];
  totals: { sources: number; ok: number; errors: number; skipped: number; created: number; modified: number; closed: number; reopened: number };
};
