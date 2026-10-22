import { autofillBlocks, normalizeAnswers } from "@/lib/autofill";
import { extensionGuard } from "@/lib/billing/http";
import { EXTENSION_VERSION, extensionOutdated, extensionUpdateAvailable } from "@/lib/extensionVersion";
import { SITE_URL } from "@/lib/site";
import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { AUTOFILL_SYSTEM } from "@/lib/prompts";
import { AutofillAnswerSchema, AutofillRequestSchema } from "@/lib/schemas";

export const maxDuration = 120;

/** La extensión de Chrome manda los campos del formulario abierto y recibe qué poner en cada uno. */
export async function POST(req: Request) {
  try {
    // Una extensión vieja sólo sabe mostrar el error: así le llega el aviso de actualizar.
    const version = req.headers.get("X-Maru-Version");
    if (extensionOutdated(version)) {
      return Response.json(
        { error: `Tu extensión de Maru está desactualizada. Bajá la versión ${EXTENSION_VERSION} en ${SITE_URL}/extension y reemplazá la carpeta en chrome://extensions.`, code: "EXTENSION_OUTDATED", updateUrl: `${SITE_URL}/extension` },
        { status: 426 },
      );
    }
    const parsed = AutofillRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new UserFacingError("No pudimos leer el formulario. Recargá la página y probá de nuevo.", "BAD_REQUEST");
    }
    const body = parsed.data;
    // El cupo se descuenta recién con un formulario válido: un pedido roto no gasta un uso.
    const limit = await extensionGuard(req);
    if (limit) return limit;
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
    const update = extensionUpdateAvailable(version) ? { latest: EXTENSION_VERSION, url: `${SITE_URL}/extension` } : undefined;
    return Response.json({ answers: normalizeAnswers(body.fields, campos, !!body.hasCv), ...(update ? { update } : {}) });
  } catch (err) {
    return errorResponse(err);
  }
}
