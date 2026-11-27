import type { Company, CompanySource, ImportRun, MonitoringRun, PilotJob, RadarSettings, SourceJobsDoc, TargetsDoc } from "../types";

/**
 * Interfaces de acceso a datos de Radar. Las pantallas y las rutas sólo conocen esto; hoy lo implementa
 * Upstash (./redis.ts). Todo lo privado recibe el `userId` de la sesión verificada, nunca un dato del cliente.
 */

export interface CompanyRepo {
  all(): Promise<Company[]>;
  getMany(ids: string[]): Promise<(Company | null)[]>;
  saveMany(companies: Company[]): Promise<void>;
}

export interface CompanySourceRepo {
  forCompanies(ids: string[]): Promise<Record<string, CompanySource[]>>;
  saveMany(byCompany: Record<string, CompanySource[]>): Promise<void>;
}

export interface TargetCompanyRepo {
  read(userId: string): Promise<TargetsDoc>;
  /** Lee, aplica `fn` y guarda con compare-and-set (reintenta si otro pedido escribió en el medio). */
  update<R>(userId: string, fn: (doc: TargetsDoc) => { doc: TargetsDoc; result: R } | null): Promise<R | null>;
}

export interface RadarSettingsRepo {
  read(userId: string): Promise<RadarSettings | null>;
  write(userId: string, settings: RadarSettings): Promise<void>;
}

export interface PilotJobRepo {
  list(userId: string): Promise<PilotJob[]>;
  replace(userId: string, jobs: PilotJob[]): Promise<void>;
}

export interface ImportRunRepo {
  list(userId: string): Promise<ImportRun[]>;
  add(userId: string, run: ImportRun): Promise<void>;
}

/** Vacantes detectadas: un índice por fuente (global) y la descripción de cada una aparte. */
export interface JobRepo {
  readIndexes(sourceIds: string[]): Promise<(SourceJobsDoc | null)[]>;
  writeIndex(doc: SourceJobsDoc): Promise<void>;
  writeDescriptions(byJobId: Record<string, string>): Promise<void>;
  readDescription(jobId: string): Promise<string | null>;
}

export interface MonitoringRunRepo {
  add(run: MonitoringRun): Promise<void>;
  recent(limit?: number): Promise<MonitoringRun[]>;
  forSource(sourceId: string): Promise<MonitoringRun[]>;
}

/** Locks con vencimiento (lease por fuente, cooldown de "Revisar ahora"). */
export interface LeaseRepo {
  acquire(key: string, owner: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

/** Empresas que alguien siguió alguna vez: el universo que recorre el worker (sin datos de quién). */
export interface FollowedRepo {
  add(companyIds: string[]): Promise<void>;
  all(): Promise<string[]>;
}

export type RadarRepos = {
  jobs: JobRepo;
  runs: MonitoringRunRepo;
  leases: LeaseRepo;
  followed: FollowedRepo;
  companies: CompanyRepo;
  sources: CompanySourceRepo;
  targets: TargetCompanyRepo;
  settings: RadarSettingsRepo;
  pilot: PilotJobRepo;
  imports: ImportRunRepo;
};
