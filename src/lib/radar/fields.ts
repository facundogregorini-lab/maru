/** Campos del importador y sus nombres (sin dependencias de Node: lo usa también la vista previa). */

export type CompanyField =
  | "rank"
  | "name"
  | "headquarters"
  | "stage"
  | "employees"
  | "activity"
  | "areas"
  | "careers"
  | "linkStatus"
  | "sources"
  | "notes"
  | "website"
  | "industry"
  | "region"
  | "ignore";

export type JobField = "priority" | "score" | "company" | "location" | "title" | "fsgp" | "reasons" | "barriers" | "url" | "evidence" | "date" | "action" | "ignore";

export const COMPANY_FIELD_LABELS: Record<CompanyField, string> = {
  rank: "Ranking regional",
  name: "Empresa",
  headquarters: "Sede",
  stage: "Etapa",
  employees: "Empleados estimados",
  activity: "Actividad",
  areas: "Áreas laborales sugeridas",
  careers: "Careers",
  linkStatus: "Estado del enlace",
  sources: "Fuentes",
  notes: "Notas",
  website: "Sitio web",
  industry: "Sector",
  region: "Región",
  ignore: "No importar",
};

export const JOB_FIELD_LABELS: Record<JobField, string> = {
  priority: "Prioridad",
  score: "Score /100",
  company: "Empresa",
  location: "Ubicación",
  title: "Puesto",
  fsgp: "F/S/G/P",
  reasons: "Motivos",
  barriers: "Barreras",
  url: "URL",
  evidence: "Evidencia",
  date: "Fecha",
  action: "Acción",
  ignore: "No importar",
};

