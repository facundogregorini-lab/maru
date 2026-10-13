import { askStructured, buildContext, errorResponse } from "@/lib/claude";
import { GENERATE_SYSTEM } from "@/lib/prompts";
import { ResultSchema, type Analysis, type CandidateInput } from "@/lib/schemas";

export const maxDuration = 300;

type Body = CandidateInput & {
  analysis: Analysis;
  answers: Record<string, string>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const content = await buildContext(body);
    const qa = body.analysis.preguntas
      .map((q) => `- ${q.pregunta}\n  Respuesta: ${body.answers[q.id]?.trim() || "(sin responder)"}`)
      .join("\n");
    content.push({
      type: "text",
      text: `<analisis_previo>\n${JSON.stringify(body.analysis, null, 2)}\n</analisis_previo>\n\n<respuestas_a_preguntas>\n${qa}\n</respuestas_a_preguntas>`,
    });
    const result = await askStructured({
      system: GENERATE_SYSTEM,
      content,
      schema: ResultSchema,
      effort: "high",
    });
    return Response.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
