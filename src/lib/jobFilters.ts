import type { RoleFamily, Seniority, Workplace } from "./match/types";

/** Filtros del buscador de búsquedas (home y /busquedas). Sin dependencias de servidor. */

export const AREAS: Record<RoleFamily, string> = {
  software: "Software",
  datos: "Datos",
  producto: "Producto",
  diseno: "Diseño",
  marketing: "Marketing",
  ventas: "Ventas",
  atencion_cliente: "Atención al cliente",
  operaciones: "Operaciones",
  finanzas: "Finanzas",
  rrhh: "Recursos humanos",
  legal: "Legal",
  administracion: "Administración",
  logistica: "Logística",
  salud: "Salud",
  educacion: "Educación",
  consultoria: "Consultoría",
  produccion: "Industria y oficios",
  gastronomia: "Gastronomía y hotelería",
  comercio: "Comercio y retail",
  seguridad: "Seguridad",
  entrenamiento_ia: "IA e idiomas (por proyecto)",
  otros: "Otras áreas",
};

export const NIVELES: Partial<Record<Seniority, string>> = {
  pasantia: "Pasantía",
  junior: "Junior",
  semi_senior: "Semi senior",
  senior: "Senior",
  lead: "Lead",
  manager: "Manager",
  director: "Director",
};

export const MODALIDADES: Partial<Record<Workplace, string>> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" };

export type JobQuery = { q: string; area: RoleFamily | ""; nivel: Seniority | ""; modalidad: Workplace | ""; donde: "ar" | "todo"; pagina: number };

const pick = <T extends string>(v: unknown, allowed: Record<string, unknown>): T | "" => (typeof v === "string" && Object.hasOwn(allowed, v) ? (v as T) : "");

/** Lee los filtros de la URL; cualquier valor desconocido se ignora. */
export function parseJobQuery(sp: Record<string, string | string[] | undefined>): JobQuery {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const pagina = Math.max(1, Math.min(50, Number.parseInt(one("pagina") ?? "1", 10) || 1));
  return {
    q: (one("q") ?? "").trim().slice(0, 80),
    area: pick<RoleFamily>(one("area"), AREAS),
    nivel: pick<Seniority>(one("nivel"), NIVELES),
    modalidad: pick<Workplace>(one("modalidad"), MODALIDADES),
    donde: one("donde") === "todo" ? "todo" : "ar",
    pagina,
  };
}
