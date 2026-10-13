import { askStructured, buildContext, errorResponse } from "@/lib/claude";
import { ANALYZE_SYSTEM } from "@/lib/prompts";
import { AnalysisSchema, type CandidateInput } from "@/lib/schemas";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as CandidateInput;
    const content = await buildContext(input);
    const analysis = await askStructured({
      system: ANALYZE_SYSTEM,
      content,
      schema: AnalysisSchema,
      effort: "medium",
    });
    return Response.json({ analysis });
  } catch (err) {
    return errorResponse(err);
  }
}
