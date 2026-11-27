/**
 * Radar laboral: las empresas donde la persona quiere trabajar, con su prioridad, y la configuración del monitoreo.
 * Vive en el navegador (`maru:radar:v1`) y, con sesión, se copia a la cuenta como el resto de los datos (src/lib/sync).
 */

export const RADAR_KEY = "maru:radar:v1";
export const RADAR_EVENT = "maru:radar";

/** Afinidad con la empresa. null = todavía sin clasificar. No es el match de un aviso. */
export type Priority = "P1" | "P2" | "P3";
export const PRIORITIES: readonly Priority[] = ["P1", "P2", "P3"];
export const PRIORITY_LABEL: Record<Priority, string> = { P1: "Prioridad 1", P2: "Prioridad 2", P3: "Por explorar" };
/** Cupos sugeridos (no son límites). */
export const PRIORITY_TARGET: Record<Priority, number | null> = { P1: 20, P2: 100, P3: null };

export const BASE_INDUSTRIES = ["IA", "Space", "Tech Startups"] as const;

/**
 * Identidad de la empresa: dominio de su sitio, bolsa de ATS o, si no hay ninguno, el nombre normalizado
 * (identidad provisoria: no se fusiona con otra que tenga dominio distinto).
 */
export type IdentityKind = "dominio" | "ats" | "nombre";

export type TargetCompany = {
  id: string;
  identity: IdentityKind;
  name: string;
  /** Dominio del sitio (sin www), si se conoce. */
  domain?: string;
  /** Bolsa de ATS detectada en la URL de Careers ("greenhouse:anthropic"). */
  board?: string;
  careersUrl?: string;
  industries: string[];
  region?: string;
  hq?: string;
  stage?: string;
  employees?: string;
  activity?: string;
  areas?: string;
  /** Lo que trae el archivo importado (fuentes, notas del research). No se mezcla con las notas personales. */
  research?: string;
  /** Ranking dentro de su sector y región en el archivo importado, si venía. */
  rank?: number;
  priority: Priority | null;
  /** Orden manual dentro de la misma prioridad (más chico primero). */
  position: number;
  notes: string;
  archived: boolean;
  origin: "importada" | "manual" | "sugerencia";
  createdAt: number;
  updatedAt: number;
};

/** Vacante del piloto del archivo importado: dato histórico, nunca se muestra como vigente ni como match actual. */
export type PilotJob = {
  id: string;
  companyId: string | null;
  company: string;
  title: string;
  location: string;
  /** Score editorial del piloto (0-100), no es el match de Maru. */
  score: number | null;
  priority: string;
  reasons: string;
  barriers: string;
  url: string;
  evidence: string;
  date: string;
  action: string;
  industry: string;
};

export type Frequency = "diaria" | "semanal" | "mensual" | "pausada";
export const FREQUENCIES: readonly Frequency[] = ["diaria", "semanal", "mensual", "pausada"];

export type MatchWeights = { experiencia: number; seniority: number; ubicacion: number; compensacion: number; interes: number };

export type RadarSettings = {
  enabled: boolean;
  frequency: Record<Priority, Frequency>;
  /** Alerta inmediata para P1 con match alto y sin bloqueo confirmado. */
  instant: boolean;
  threshold: number;
  digest: boolean;
  /** 0 = domingo … 6 = sábado. */
  digestDay: number;
  digestTime: string;
  timezone: string;
  /** Consentimiento explícito para recibir el resumen por email. Sin esto, sólo dentro de Maru. */
  emailConsent: boolean;
  weights: MatchWeights;
};

export type DiscoveryFeedback = "aceptada" | "rechazada";

export type RadarState = {
  v: 1;
  companies: Record<string, TargetCompany>;
  pilot: PilotJob[];
  /** Fecha del archivo de donde salió el piloto ("25/11/2026"), si se conoce. */
  pilotDate?: string;
  settings: RadarSettings;
  feedback: Record<string, DiscoveryFeedback>;
  /** Última vez que la persona abrió Oportunidades (para "nuevas desde tu última visita"). */
  lastSeenOpportunitiesAt?: number;
  updatedAt: number;
};

export const DEFAULT_WEIGHTS: MatchWeights = { experiencia: 40, seniority: 20, ubicacion: 20, compensacion: 10, interes: 10 };

export const DEFAULT_SETTINGS: RadarSettings = {
  enabled: true,
  frequency: { P1: "diaria", P2: "semanal", P3: "mensual" },
  instant: false,
  threshold: 85,
  digest: true,
  digestDay: 1,
  digestTime: "09:00",
  timezone: "America/Argentina/Buenos_Aires",
  emailConsent: false,
  weights: DEFAULT_WEIGHTS,
};

export const EMPTY_RADAR: RadarState = { v: 1, companies: {}, pilot: [], settings: DEFAULT_SETTINGS, feedback: {}, updatedAt: 0 };
