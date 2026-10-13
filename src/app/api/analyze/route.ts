import { askStructured, cvBlocks, errorResponse, feedbackBlock, jobBlock } from "@/lib/claude";
import { ANALYZE_SYSTEM } from "@/lib/prompts";
import { AnalysisSchema, type CvSource, type JobInput } from "@/lib/schemas";

export const maxDuration = 300;

type Body = JobInput & { feedback: string; source: CvSource };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const content = [feedbackBlock(body.feedback), ...(await cvBlocks(body.source)), await jobBlock(body)];
    const analysis = await askStructured({ system: ANALYZE_SYSTEM, content, schema: AnalysisSchema, effort: "medium" });
    return Response.json({ analysis });
  } catch (err) {
    return errorResponse(err);
  }
}
