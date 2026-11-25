import { extensionGuard } from "@/lib/billing/http";
import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { ContactosPlanRequestSchema, ContactosPlanSchema, buildSearches, contactosPlanBlocks } from "@/lib/contactos";
import { extensionOutdated } from "@/lib/extensionVersion";
import { CONTACTOS_PLAN_SYSTEM } from "@/lib/prompts";

export const maxDuration = 60;

/**
 * Paso 1 de «Contactos de la vacante» (extensión de Chrome): lee la vacante y devuelve qué buscar en LinkedIn.
 * Las búsquedas las hace la extensión en el navegador de la persona; acá no se consulta LinkedIn.
 * Cuenta un uso del cupo de contactos.
 */
export async function POST(req: Request) {
  try {
    if (extensionOutdated(req.headers.get("X-Maru-Version"))) {
      throw new UserFacingError("Actualizá la extensión de Maru para buscar contactos.", "EXTENSION_OUTDATED", 426);
    }
    const parsed = ContactosPlanRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new UserFacingError("No pudimos leer la vacante. Recargá la página y probá de nuevo.", "BAD_REQUEST");
    const body = parsed.data;
    if (body.page.text.trim().length < 200) {
      throw new UserFacingError("No encontramos la vacante en esta pestaña. Abrí el aviso completo y probá de nuevo.", "JOB_MISSING", 422);
    }
    const quota = await extensionGuard(req, "contactos");
    if (quota.blocked) return quota.blocked;
    // Datos copiados de la página: sin revisión editorial.
    const plan = await askStructured({ system: CONTACTOS_PLAN_SYSTEM, content: contactosPlanBlocks(body), schema: ContactosPlanSchema, effort: "low", maxTokens: 2000, verbatim: true });
    const busquedas = buildSearches(plan);
    if (!busquedas.length) {
      throw new UserFacingError("No pudimos saber qué empresa publica esta vacante. Abrí el aviso en el sitio de la empresa o en LinkedIn y probá de nuevo.", "COMPANY_MISSING", 422);
    }
    return Response.json({
      empresa: plan.empresa.trim(),
      puesto: plan.puesto.trim(),
      area: plan.area.trim(),
      busquedas,
      ...(quota.remaining !== null ? { remaining: quota.remaining, limit: quota.limit } : {}),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
