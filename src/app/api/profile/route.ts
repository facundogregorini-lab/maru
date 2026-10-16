import { UserFacingError, askStructured, cvBlocks, errorResponse, unreadable } from "@/lib/claude";
import { normalizeCvSource } from "@/lib/cvSource";
import { findGaps } from "@/lib/gaps";
import { PROFILE_SYSTEM } from "@/lib/prompts";
import { ProfileSchema } from "@/lib/schemas";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const source = normalizeCvSource(await req.json());
    const content = await cvBlocks(source);
    content.push({ type: "text", text: "Extraé el perfil completo de este documento." });
    const profile = await askStructured({ system: PROFILE_SYSTEM, content, schema: ProfileSchema, effort: "low" });
    // Sin experiencia ni estudios: el PDF no tenía contenido legible (imagen, escaneo, archivo equivocado).
    if (!profile.experiencia.length && !profile.educacion.length) {
      if (source?.kind !== "texto") throw unreadable();
      // Un resumen pegado puede tener habilidades y trayectoria sin empresas/fechas estructuradas.
      // No lo tratamos como un archivo escaneado ni inventamos antecedentes para dejarlo pasar.
      if (!profile.titulo.trim() && !profile.aptitudes.length && profile.resumen.trim().length < 80) {
        throw new UserFacingError("No encontramos suficientes datos de tu experiencia. Sumá el rol, las tareas o habilidades y algún proyecto o estudio para seguir.", "CV_NEEDS_DETAIL", 422);
      }
    }
    return Response.json({ profile, gaps: findGaps(profile) });
  } catch (err) {
    return errorResponse(err);
  }
}
