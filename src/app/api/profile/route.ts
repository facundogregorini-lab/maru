import { askStructured, cvBlocks, errorResponse } from "@/lib/claude";
import { findGaps } from "@/lib/gaps";
import { PROFILE_SYSTEM } from "@/lib/prompts";
import { ProfileSchema, type CvSource } from "@/lib/schemas";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { source } = (await req.json()) as { source: CvSource };
    const content = await cvBlocks(source);
    content.push({ type: "text", text: "Extraé el perfil completo de este documento." });
    const profile = await askStructured({ system: PROFILE_SYSTEM, content, schema: ProfileSchema, effort: "low" });
    if (!profile.experiencia.length && !profile.educacion.length) {
      return Response.json(
        { error: "No encontramos experiencia ni estudios en el archivo. ¿Es el PDF correcto?", code: "PROFILE_EMPTY" },
        { status: 422 },
      );
    }
    return Response.json({ profile, gaps: findGaps(profile) });
  } catch (err) {
    return errorResponse(err);
  }
}
