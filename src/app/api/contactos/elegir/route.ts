import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { ContactosElegidosSchema, ContactosElegirRequestSchema, contactosBlocks, finalizeContacts } from "@/lib/contactos";
import { extensionOutdated } from "@/lib/extensionVersion";
import { CONTACTOS_SYSTEM } from "@/lib/prompts";

export const maxDuration = 60;

/**
 * Paso 2 de «Contactos de la vacante»: con las tarjetas que la extensión vio en LinkedIn, elige a quiénes escribirles
 * y redacta la nota de la invitación y el mensaje para cuando acepten. La persona revisa y envía cada invitación.
 * El cupo se cuenta en el paso 1 (/api/contactos/plan).
 */
export async function POST(req: Request) {
  try {
    if (extensionOutdated(req.headers.get("X-Maru-Version"))) {
      throw new UserFacingError("Actualizá la extensión de Maru para buscar contactos.", "EXTENSION_OUTDATED", 426);
    }
    const parsed = ContactosElegirRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new UserFacingError("No pudimos leer los resultados de LinkedIn. Probá de nuevo.", "BAD_REQUEST");
    const body = parsed.data;
    const { contactos } = await askStructured({
      system: CONTACTOS_SYSTEM,
      content: contactosBlocks(body),
      schema: ContactosElegidosSchema,
      effort: "low",
      maxTokens: 4000,
      // Sólo la prosa: nombres, cargos y urls se copian de las tarjetas.
      editorialPaths: ["contactos.*.motivo", "contactos.*.nota", "contactos.*.mensaje"],
    });
    return Response.json({ contactos: finalizeContacts(contactos, body.tarjetas) });
  } catch (err) {
    return errorResponse(err);
  }
}
