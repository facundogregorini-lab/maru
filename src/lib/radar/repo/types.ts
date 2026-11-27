import type { Company, CompanySource, ImportRun, PilotJob, RadarSettings, TargetsDoc } from "../types";

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

export type RadarRepos = {
  companies: CompanyRepo;
  sources: CompanySourceRepo;
  targets: TargetCompanyRepo;
  settings: RadarSettingsRepo;
  pilot: PilotJobRepo;
  imports: ImportRunRepo;
};
