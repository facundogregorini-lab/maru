import { planGuard } from "@/lib/billing/http";
import { askStructured, errorResponse, feedbackBlock, jobBlock } from "@/lib/claude";
import { GENERATE_SYSTEM } from "@/lib/prompts";
import { GenerationSchema, type Analysis, type JobInput, type Profile } from "@/lib/schemas";

export const maxDuration = 300;

type Body = JobInput & {
  feedback?: string;
  profile: Profile;
  analysis: Analysis;
  answers: Record<string, string>;
};

export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  try {
    const body = (await req.json()) as Body;
    const indexed = body.profile.experiencia.map((e, indice) => ({ indice, ...e }));
    const qa = body.analysis.preguntas
      .map((q) => `- ${q.pregunta}\n  Respuesta: ${body.answers[q.id]?.trim() || "(sin responder)"}`)
      .join("\n");
    const content = [
      await jobBlock(body),
      feedbackBlock(body.feedback),
      {
        type: "text" as const,
        text: [
          `<perfil>\n${JSON.stringify({ ...body.profile, experiencia: indexed }, null, 2)}\n</perfil>`,
          `<analisis_previo>\n${JSON.stringify(body.analysis, null, 2)}\n</analisis_previo>`,
          `<respuestas_a_preguntas>\n${qa}\n</respuestas_a_preguntas>`,
        ].join("\n\n"),
      },
    ];
    const limit = await planGuard(req, "cv");
    if (limit) return limit;
    const generation = await askStructured({
      editorialPaths: ["titular", "resumen", "logros_clave.*", "experiencias.*.logros.*", "cambios_clave.*", "recomendaciones_formulario.*.respuesta_sugerida", "recomendaciones_formulario.*.por_que", "recomendaciones_formulario.*.tip"],
      system: GENERATE_SYSTEM, content, schema: GenerationSchema, effort: "high" });
    return Response.json({ generation });
  } catch (err) {
    return errorResponse(err);
  }
}
