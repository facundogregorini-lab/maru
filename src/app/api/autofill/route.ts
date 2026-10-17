import { autofillBlocks, normalizeAnswers } from "@/lib/autofill";
import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { AUTOFILL_SYSTEM } from "@/lib/prompts";
import { AutofillAnswerSchema, AutofillRequestSchema } from "@/lib/schemas";

export const maxDuration = 120;

/** La extensión de Chrome manda los campos del formulario abierto y recibe qué poner en cada uno. */
export async function POST(req: Request) {
  try {
    const parsed = AutofillRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new UserFacingError("No pudimos leer el formulario. Recargá la página y probá de nuevo.", "BAD_REQUEST");
    }
    const body = parsed.data;
    const { campos } = await askStructured({
      editorialPaths: (draft) => draft.campos.flatMap((campo, i) => [
        `campos.${i}.nota`,
        ...(campo.revisar && body.fields.find((field) => field.id === campo.id)?.tipo === "texto_largo" ? [`campos.${i}.valor`] : []),
      ]),
      system: AUTOFILL_SYSTEM,
      content: autofillBlocks(body),
      schema: AutofillAnswerSchema,
      effort: "low",
    });
    return Response.json({ answers: normalizeAnswers(body.fields, campos, !!body.hasCv) });
  } catch (err) {
    return errorResponse(err);
  }
}
