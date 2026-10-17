import { planGuard } from "@/lib/billing/http";
import { UserFacingError, askStructured, cvBlocks, errorResponse, jobBlock } from "@/lib/claude";
import { normalizeCvSource } from "@/lib/cvSource";
import { CARTA_SYSTEM } from "@/lib/prompts";
import { CartaSchema, type CartaOpciones, type CvSource, type JobInput } from "@/lib/schemas";

export const maxDuration = 300;

type Body = {
  /** Búsqueda concreta (link y/o texto) … */
  job?: JobInput;
  /** … o postulación espontánea. */
  espontanea?: { empresa: string; rol: string };
  motivacion: string;
  source?: CvSource;
  opciones: CartaOpciones;
};

export async function POST(req: Request) {
  const auth = await planGuard(req);
  if (auth) return auth;
  try {
    const body = (await req.json()) as Body;
    if (!body.motivacion?.trim()) throw new UserFacingError("Contanos qué querés transmitir en tu carta.", "FEEDBACK_MISSING");

    let busqueda;
    if (body.espontanea) {
      const { empresa, rol } = body.espontanea;
      if (!empresa?.trim()) throw new UserFacingError("Contanos a qué empresa le escribís.", "JOB_MISSING");
      busqueda = {
        type: "text" as const,
        text: `<postulacion_espontanea>\nEmpresa: ${empresa.trim()}\nRol o área de interés: ${rol?.trim() || "(abierto)"}\nNo hay una publicación: no inventes datos de la empresa.\n</postulacion_espontanea>`,
      };
    } else {
      busqueda = await jobBlock(body.job ?? { jobUrl: "" });
    }

    const o = body.opciones;
    const content = [
      busqueda,
      { type: "text" as const, text: `<lo_que_quiere_contar>\n${body.motivacion.trim()}\n</lo_que_quiere_contar>` },
      ...(await cvBlocks(normalizeCvSource(body))),
      {
        type: "text" as const,
        text: [
          "<opciones>",
          `Tono: ${o.tono}`,
          `Largo: ${o.largo}`,
          `Idioma: ${o.idioma}`,
          `Destinatario: ${o.destinatario?.trim() || "(no se conoce)"}`,
          "</opciones>",
        ].join("\n"),
      },
    ];
    const limit = await planGuard(req, "carta");
    if (limit) return limit;
    const carta = await askStructured({
      editorialPaths: ["saludo", "parrafos.*", "cierre", "asunto_email", "mensaje_corto", "requisitos_cubiertos.*.como", "consejos.*"],
      system: CARTA_SYSTEM, content, schema: CartaSchema, effort: "high" });
    return Response.json({ carta });
  } catch (err) {
    return errorResponse(err);
  }
}
