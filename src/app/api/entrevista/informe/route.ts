import { planGuard } from "@/lib/billing/http";
import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { clampHistorial, contextoEntrevista, historialTexto } from "@/lib/entrevista";
import { ENTREVISTA_INFORME_SYSTEM } from "@/lib/prompts";
import { InformeSchema, type EntrevistaOpciones, type EntrevistaPlan, type Intercambio } from "@/lib/schemas";

export const maxDuration = 300;

type Body = { plan: EntrevistaPlan; opciones?: EntrevistaOpciones; historial: Intercambio[] };

export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  try {
    const b = (await req.json()) as Body;
    const historial = clampHistorial(b.historial).filter((x) => x.respuesta.trim());
    if (!b.plan?.preguntas) throw new UserFacingError("Falta la entrevista.", "BAD_REQUEST");
    if (!historial.length) throw new UserFacingError("Respondé al menos una pregunta para recibir tu informe.", "NO_ANSWERS");
    const informe = await askStructured({
      system: ENTREVISTA_INFORME_SYSTEM,
      schema: InformeSchema,
      effort: "medium",
      content: [{ type: "text", text: `${contextoEntrevista(b.plan, b.opciones)}\n\n<historial>\n${historialTexto(historial)}\n</historial>` }],
    });
    return Response.json({ informe });
  } catch (err) {
    return errorResponse(err);
  }
}
