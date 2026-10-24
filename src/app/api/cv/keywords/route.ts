import { paidFeatures, planGuard } from "@/lib/billing/http";
import { askStructured, errorResponse, UserFacingError } from "@/lib/claude";
import { KEYWORDS_SYSTEM } from "@/lib/prompts";
import { cleanProposals } from "@/lib/keywords";
import { KeywordPhrasesSchema } from "@/lib/schemas";
import { z } from "zod";

export const maxDuration = 60;

const Body = z.object({
  puesto: z.string().max(300),
  idioma: z.string().max(10),
  palabras: z.array(z.string().min(1).max(80)).min(1).max(20),
  experiencias: z
    .array(z.object({ id: z.string().max(60), cargo: z.string().max(200), empresa: z.string().max(200), logros: z.array(z.string().max(600)).max(12) }))
    .min(1)
    .max(12),
  /** Para "Otra frase": la propuesta anterior de esa palabra, que no hay que repetir. */
  evitar: z.record(z.string(), z.string().max(600)).optional(),
});

/**
 * Propone, para cada palabra clave que falta, un logro nuevo en la experiencia más relevante del CV.
 * Las propuestas no se agregan solas: la persona acepta, pide otra o la escribe. Si ninguna experiencia
 * respalda la palabra, no se inventa una frase. Es del plan pago: sin plan responde 402 PLAN_FEATURE.
 */
export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  if (!(await paidFeatures(req)))
    return Response.json({ error: "Cubrir las palabras clave es parte de los planes de Maru.", code: "PLAN_FEATURE", upgradeUrl: "/precios" }, { status: 402 });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new UserFacingError("No pudimos leer el CV. Recargá la página y probá de nuevo.", "BAD_REQUEST", 400);
    const b = parsed.data;
    const { propuestas } = await askStructured({
      system: KEYWORDS_SYSTEM,
      schema: KeywordPhrasesSchema,
      effort: "low",
      maxTokens: 8000,
      editorialPaths: (draft) => draft.propuestas.flatMap((p, i) => (p.frase ? [`propuestas.${i}.frase`] : [])),
      content: [
        {
          type: "text",
          text: [
            `Vacante: ${b.puesto || "(sin título)"}`,
            `Idioma del CV: ${b.idioma}`,
            `Palabras clave que faltan:\n${b.palabras.map((p) => `- ${p}`).join("\n")}`,
            `Experiencias:\n${b.experiencias.map((e) => `<experiencia id="${e.id}" cargo="${e.cargo.replace(/"/g, "'")}" empresa="${e.empresa.replace(/"/g, "'")}">\n${e.logros.map((l) => `- ${l}`).join("\n")}\n</experiencia>`).join("\n")}`,
            ...(b.evitar && Object.keys(b.evitar).length ? [`Frases a evitar (ya propuestas):\n${Object.entries(b.evitar).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`] : []),
          ].join("\n\n"),
        },
      ],
    });
    return Response.json({ propuestas: cleanProposals(propuestas, b.palabras, b.experiencias.map((e) => e.id)) });
  } catch (err) {
    return errorResponse(err);
  }
}
