import { planGuard } from "@/lib/billing/http";
import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { clampHistorial, contextoEntrevista, historialTexto } from "@/lib/entrevista";
import { ENTREVISTA_TURNO_SYSTEM } from "@/lib/prompts";
import { TurnoSchema, type EntrevistaOpciones, type EntrevistaPlan, type Intercambio } from "@/lib/schemas";

export const maxDuration = 60;

type Body = { plan: EntrevistaPlan; opciones?: EntrevistaOpciones; historial: Intercambio[]; puede_repreguntar: boolean };

/** Reacción a la última respuesta y, si hace falta, una repregunta. Rápido: esfuerzo bajo. */
export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  try {
    const b = (await req.json()) as Body;
    const historial = clampHistorial(b.historial);
    if (!b.plan?.preguntas || !historial.length) throw new UserFacingError("Falta la entrevista.", "BAD_REQUEST");
    const turno = await askStructured({
      system: ENTREVISTA_TURNO_SYSTEM,
      schema: TurnoSchema,
      effort: "low",
      maxTokens: 2000,
      content: [
        {
          type: "text",
          text: `${contextoEntrevista(b.plan, b.opciones)}\n\n<historial>\n${historialTexto(historial)}\n</historial>\n\npuede_repreguntar: ${b.puede_repreguntar ? "true" : "false"}`,
        },
      ],
    });
    return Response.json({ turno: b.puede_repreguntar ? turno : { ...turno, repregunta: "" } });
  } catch (err) {
    return errorResponse(err);
  }
}
