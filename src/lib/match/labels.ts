import { fold } from "./text";
import type { EmploymentType, Field, RoleFamily, Seniority, Workplace } from "./types";

/** Etiquetas visibles (se usan en el navegador y en el servidor). */

export const SENIORITY_LABEL: Record<Seniority, string> = {
  pasantia: "Pasantía",
  junior: "Junior",
  semi_senior: "Semi senior",
  senior: "Senior",
  lead: "Lead / Staff",
  manager: "Manager",
  director: "Director/a / Head",
  ejecutivo: "Ejecutivo/a (C-level, VP)",
};

export const CONTRACT_LABEL: Record<EmploymentType, string> = {
  full_time: "Tiempo completo",
  part_time: "Medio tiempo",
  contrato: "Contractor",
  freelance: "Freelance",
  pasantia: "Pasantía",
  temporal: "Temporal",
};

export const FAMILY_LABEL: Record<RoleFamily, string> = {
  software: "Tecnología y desarrollo",
  datos: "Datos y análisis",
  producto: "Producto",
  diseno: "Diseño",
  marketing: "Marketing y comunicación",
  ventas: "Ventas y desarrollo de negocios",
  atencion_cliente: "Atención y éxito del cliente",
  operaciones: "Operaciones y proyectos",
  finanzas: "Finanzas y contabilidad",
  rrhh: "Recursos humanos",
  legal: "Legal",
  administracion: "Administración",
  logistica: "Logística y supply chain",
  salud: "Salud",
  educacion: "Educación",
  consultoria: "Consultoría",
  produccion: "Industria, producción y oficios",
  gastronomia: "Gastronomía y hotelería",
  comercio: "Comercio y atención en tienda",
  seguridad: "Seguridad y vigilancia",
  entrenamiento_ia: "IA, idiomas y tareas por proyecto",
  otros: "Otras áreas",
};

export const WORKPLACE_OPTIONS: [Workplace, string][] = [
  ["remoto", "Remoto"],
  ["hibrido", "Híbrido"],
  ["presencial", "Presencial"],
];

/** Prefijo de la evidencia cuando la modalidad no la dice el aviso sino que la deducimos. */
export const INFERRED = "inferido:";
export const isInferred = (f: Field<unknown>) => !!f.evidence?.startsWith(INFERRED);

/**
 * Nombres que no identifican a la empresa ("Importante empresa del sector", "Confidencial"):
 * se muestran como "Empresa confidencial" y no se agrupan entre sí.
 */
const GENERIC_COMPANY = [
  /\bconfiden(cial|tial)\b|^(cliente|empresa) anonim[oa]$/,
  /^(para )?(una )?(importante|reconocida|prestigiosa|destacada|lider|gran) (empresa|compania|grupo|organizacion|firma|multinacional)\b/,
  /^empresa (de|del|lider|multinacional|nacional|internacional|consumo)\b/,
  /^(employer|empresa|company|cliente|n\/a)$/,
];
export const isGenericCompany = (name: string) => {
  const f = fold(name);
  return !f || GENERIC_COMPANY.some((re) => re.test(f));
};
export const displayCompany = (name: string) => (isGenericCompany(name) ? "Empresa confidencial" : name);

/** Consultoras de selección y empresas de servicios eventuales: publican para una empresa cliente. */
const CONSULTORA =
  /\b(adecco|manpower(group)?|randstad|bayton|grupo gestion|adn recursos humanos|adn - recursos humanos|consultores de empresas|umbral capital humano|pullmen|servicemen|michael page|page personnel|hays|kelly services|david kennedy|servicios eventuales|seleccion de personal|consultora de (rrhh|recursos humanos))\b/;
export const isConsultora = (name: string) => CONSULTORA.test(fold(name));
