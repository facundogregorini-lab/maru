import { UserFacingError, jobBlock } from "./claude";
import type { TargetInput } from "./schemas";

/** Bloque de contexto "para qué búsqueda": una vacante concreta (link/texto) o un rol en general. */
export async function targetBlock(t: TargetInput) {
  if (t.general) {
    const rol = t.general.rol?.trim();
    if (!rol) throw new UserFacingError("Contanos a qué rol apuntás.", "JOB_MISSING");
    return {
      type: "text" as const,
      text: `<objetivo_general>\nRol: ${rol}\nEmpresa o industria: ${t.general.empresa?.trim() || "(abierto)"}\nNo hay una publicación concreta: no inventes datos de ninguna empresa.\n</objetivo_general>`,
    };
  }
  return jobBlock(t.job ?? { jobUrl: "" });
}
