import { planGuard } from "@/lib/billing/http";
import { askStructured, cvBlocks, errorResponse } from "@/lib/claude";
import { normalizeCvSource } from "@/lib/cvSource";
import { ENTREVISTA_PLAN_SYSTEM } from "@/lib/prompts";
import { EntrevistaPlanSchema, type CvSource, type EntrevistaOpciones, type TargetInput } from "@/lib/schemas";
import { targetBlock } from "@/lib/target";

export const maxDuration = 300;

type Body = TargetInput & { source?: CvSource; opciones: EntrevistaOpciones };

export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  try {
    const body = (await req.json()) as Body;
    const o = body.opciones;
    const content = [
      await targetBlock(body),
      ...(await cvBlocks(normalizeCvSource(body))),
      {
        type: "text" as const,
        text: `<opciones>\nTipo: ${o.tipo}\nDificultad: ${o.dificultad}\nCantidad de preguntas: ${o.preguntas}\nIdioma: ${o.idioma}\n</opciones>`,
      },
    ];
    const limit = await planGuard(req, "entrevista");
    if (limit) return limit;
    const plan = await askStructured({ system: ENTREVISTA_PLAN_SYSTEM, content, schema: EntrevistaPlanSchema, effort: "medium" });
    return Response.json({ plan: { ...plan, preguntas: plan.preguntas.slice(0, o.preguntas) } });
  } catch (err) {
    return errorResponse(err);
  }
}
