import type { EmploymentType, RoleFamily, Seniority, Workplace } from "./types";

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
  otros: "Otras áreas",
};

export const WORKPLACE_OPTIONS: [Workplace, string][] = [
  ["remoto", "Remoto"],
  ["hibrido", "Híbrido"],
  ["presencial", "Presencial"],
];
