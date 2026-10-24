import { planGuard, usageGuard } from "@/lib/billing/http";
import { askStructured, errorResponse } from "@/lib/claude";
import { objetivoBlock } from "@/lib/objetivo";
import { CV_GENERATE_SYSTEM } from "@/lib/prompts";
import { CvGenerationSchema, type CvAnalysis, type Objetivo, type Profile } from "@/lib/schemas";

export const maxDuration = 300;

type Body = {
  profile: Profile;
  objetivo: Objetivo;
  notas?: string;
  analysis: CvAnalysis;
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
      objetivoBlock(body.objetivo, body.notas ?? ""),
      {
        type: "text" as const,
        text: [
          `<perfil>\n${JSON.stringify({ ...body.profile, experiencia: indexed }, null, 2)}\n</perfil>`,
          `<analisis_previo>\n${JSON.stringify(body.analysis, null, 2)}\n</analisis_previo>`,
          `<respuestas_a_preguntas>\n${qa}\n</respuestas_a_preguntas>`,
        ].join("\n\n"),
      },
    ];
    const usage = await usageGuard(req, "cv");
    if (usage.blocked) return usage.blocked;
    const generation = await askStructured({
      editorialPaths: ["titular", "resumen", "logros_clave.*", "experiencias.*.logros.*", "cambios_clave.*", "consejos.*"],
      system: CV_GENERATE_SYSTEM, content, schema: CvGenerationSchema, effort: "high" }).catch(async (err) => { await usage.release(); throw err; });
    return Response.json({ generation });
  } catch (err) {
    return errorResponse(err);
  }
}
