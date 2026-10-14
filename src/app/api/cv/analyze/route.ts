import { askStructured, cvBlocks, errorResponse } from "@/lib/claude";
import { normalizeCvSource } from "@/lib/cvSource";
import { objetivoBlock } from "@/lib/objetivo";
import { CV_ANALYZE_SYSTEM } from "@/lib/prompts";
import { CvAnalysisSchema, type CvSource, type Objetivo } from "@/lib/schemas";

export const maxDuration = 300;

type Body = { source?: CvSource; objetivo: Objetivo; notas?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const content = [...(await cvBlocks(normalizeCvSource(body))), objetivoBlock(body.objetivo, body.notas ?? "")];
    const analysis = await askStructured({ system: CV_ANALYZE_SYSTEM, content, schema: CvAnalysisSchema, effort: "medium" });
    return Response.json({ analysis });
  } catch (err) {
    return errorResponse(err);
  }
}
