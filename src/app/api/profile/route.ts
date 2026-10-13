import { askStructured, cvBlocks, errorResponse, unreadable } from "@/lib/claude";
import { normalizeCvSource } from "@/lib/cvSource";
import { findGaps } from "@/lib/gaps";
import { PROFILE_SYSTEM } from "@/lib/prompts";
import { ProfileSchema } from "@/lib/schemas";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const content = await cvBlocks(normalizeCvSource(await req.json()));
    content.push({ type: "text", text: "Extraé el perfil completo de este documento." });
    const profile = await askStructured({ system: PROFILE_SYSTEM, content, schema: ProfileSchema, effort: "low" });
    // Sin experiencia ni estudios: el PDF no tenía contenido legible (imagen, escaneo, archivo equivocado).
    if (!profile.experiencia.length && !profile.educacion.length) throw unreadable();
    return Response.json({ profile, gaps: findGaps(profile) });
  } catch (err) {
    return errorResponse(err);
  }
}
