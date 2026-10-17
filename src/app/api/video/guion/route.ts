import { planGuard } from "@/lib/billing/http";
import { UserFacingError, askStructured, cvBlocks, errorResponse } from "@/lib/claude";
import { normalizeCvSource } from "@/lib/cvSource";
import { VIDEO_GUION_SYSTEM } from "@/lib/prompts";
import { VideoGuionSchema, type CvSource, type TargetInput, type VideoOpciones } from "@/lib/schemas";
import { targetBlock } from "@/lib/target";

export const maxDuration = 300;

type Body = TargetInput & { motivacion: string; source?: CvSource; opciones: VideoOpciones };

export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  try {
    const body = (await req.json()) as Body;
    if (!body.motivacion?.trim()) throw new UserFacingError("Contanos qué querés transmitir en tu video.", "FEEDBACK_MISSING");
    const o = body.opciones;
    const content = [
      await targetBlock(body),
      { type: "text" as const, text: `<lo_que_quiere_transmitir>\n${body.motivacion.trim()}\n</lo_que_quiere_transmitir>` },
      ...(await cvBlocks(normalizeCvSource(body))),
      { type: "text" as const, text: `<opciones>\nDuración: ${o.duracion} segundos\nTono: ${o.tono}\nIdioma: ${o.idioma}\n</opciones>` },
    ];
    const limit = await planGuard(req, "video");
    if (limit) return limit;
    const guion = await askStructured({
      editorialPaths: ["bloques.*.texto", "bloques.*.tip", "consejos.*", "mensaje_envio"],
      system: VIDEO_GUION_SYSTEM, content, schema: VideoGuionSchema, effort: "medium" });
    return Response.json({ guion });
  } catch (err) {
    return errorResponse(err);
  }
}
