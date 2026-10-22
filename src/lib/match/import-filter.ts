import { familyOf } from "./extract";
import { fold } from "./text";
import type { NormalizedPosting, RoleFamily } from "./types";

/**
 * Qué entra de los proveedores con cuota (Apify, Google Jobs, Fantastic). Decisión del dueño (19/10/2026):
 * sólo áreas profesionales, como en jobright. Oficios, logística, comercio, gastronomía, salud, docencia,
 * seguridad y tareas de IA por proyecto quedan afuera, igual que los puestos de calle, depósito o mostrador.
 * No se aplica a las bolsas de empleadores (ATS), que se sincronizan gratis.
 */
export const IMPORT_FAMILIES: ReadonlySet<RoleFamily> = new Set<RoleFamily>([
  "software", "datos", "producto", "diseno", "marketing", "finanzas", "consultoria", "legal",
  "rrhh", "operaciones", "ventas", "administracion",
]);

/** Puestos que no queremos aunque la familia sea válida ("Administrativo de mostrador", "Vendedor viajante"). */
const NOT_WANTED_TITLE = /\b(chofer|conductor|driver|repartidor|reparto|cadete|operari[oa]s?|mostrador|cajer[oa]s?|repositor|moz[oa]s?|cociner|ayudante|vigilador|limpieza|mystery shopper|comprador sorpresa|promotor|promovendedor|telemarket|televent|call center|contact center|revendedor|vendedor(a|es|as)? (ambulante|independiente|viajante|de salon|de local|de tienda|de mostrador|de indumentaria|de calzado|puerta a puerta)|asesor(a|es|as)? comercial(es)? independiente)/;

/** Atención al cliente y "Otras áreas" entran sólo con puestos de analista para arriba ("Customer Success Manager"). */
const PROFESSIONAL_TITLE = /\b(analyst|analista|specialist|especialista|manager|gerente|lead|lider|consultant|consultor|customer success|customer experience|experiencia del cliente)\b/;

/**
 * Compras, supply chain y comercio exterior de analista para arriba son puestos profesionales aunque caigan en
 * logística (22/10: se perdía la mitad de las búsquedas generalistas). Depósito, choferes y jefaturas de
 * logística siguen afuera.
 */
const SUPPLY_TITLE = /\b(analyst|analista|specialist|especialista|buyer|comprador(a|es)?|compras|procurement|sourcing|planner|planificador(a|es)?|planeamiento|supply chain|comercio exterior|demand)\b/;

/** Programas de ingreso para profesionales: trainee, jóvenes profesionales, graduados y pasantías. */
const ENTRY_PROGRAM = /\b(trainee|jovenes profesionales|joven profesional|graduate|graduad[oa]s?|pasant[ei]a?s?|intern(ship)?)\b/;

export type ImportRejection = "puesto_no_buscado" | "fuera_de_area";

export function importRejection(title: string, family: RoleFamily): ImportRejection | null {
  const t = ` ${fold(title).replace(/\/(a|as|o|os|es)\b/g, "")} `;
  if (NOT_WANTED_TITLE.test(t)) return "puesto_no_buscado";
  if (IMPORT_FAMILIES.has(family)) return null;
  if ((family === "atencion_cliente" || family === "otros") && (PROFESSIONAL_TITLE.test(t) || ENTRY_PROGRAM.test(t) || SUPPLY_TITLE.test(t))) return null;
  if (family === "logistica" && SUPPLY_TITLE.test(t)) return null;
  return "fuera_de_area";
}

/** Separa lo que entra de lo que no, con el conteo de rechazos para el resumen de la corrida. */
export function filterImported(postings: NormalizedPosting[]) {
  const kept: NormalizedPosting[] = [];
  const rejected: Partial<Record<ImportRejection, number>> = {};
  for (const p of postings) {
    const why = importRejection(p.title, familyOf(p.title, p.department, p.descriptionText).value);
    if (why) rejected[why] = (rejected[why] ?? 0) + 1;
    else kept.push(p);
  }
  return { kept, rejected };
}
