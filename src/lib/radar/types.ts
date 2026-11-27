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

export type SourceProvider = "greenhouse" | "lever" | "ashby" | "careers";
/** pendiente: registrada, sin revisar; las demás llegan con el monitoreo (sesión 3). */
export type SourceStatus = "pendiente" | "verificada" | "verificada_vacia" | "parcial" | "error";

export type CompanySource = {
  id: string;
  companyId: string;
  provider: SourceProvider;
  careersUrl: string;
  externalBoardId: string | null;
  status: SourceStatus;
  /** "Estado del enlace" del Sheet, tal cual. */
  declaredStatus: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextDueAt: string | null;
  failureCount: number;
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
