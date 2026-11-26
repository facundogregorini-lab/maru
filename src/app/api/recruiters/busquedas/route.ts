import { UserFacingError, errorResponse } from "@/lib/claude";
import { avisoText, buildIcp } from "@/lib/recruiters/ai";
import { recJson, recruiterEmail, reserveAi } from "@/lib/recruiters/http";
import { publicBusqueda } from "@/lib/recruiters/logic";
import { countBusquedas, dailyAiLimit, listBusquedas, newId, ownerId, refundAi, saveBusqueda } from "@/lib/recruiters/store";
import { CrearBusquedaSchema, LIMITS, type Busqueda } from "@/lib/recruiters/types";

export const maxDuration = 120;

/** Las búsquedas de la cuenta, de la más reciente a la más vieja. */
export async function GET(req: Request) {
  try {
    const email = recruiterEmail(req);
    const all = await listBusquedas(email);
    return recJson({
      busquedas: all.map((b) => ({ id: b.id, titulo: b.titulo, version: b.icps[b.icps.length - 1]?.version ?? 1, borrador: b.borrador, actualizadaEn: b.actualizadaEn })),
      limiteDiario: dailyAiLimit(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Nueva búsqueda: con el brief (y opcionalmente el aviso y un CV de referencia) la IA arma la versión 1 del perfil ideal. */
export async function POST(req: Request) {
  try {
    const email = recruiterEmail(req);
    const parsed = CrearBusquedaSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new UserFacingError("Contanos a quién buscás en al menos una oración (20 caracteres).", "BAD_REQUEST");
    const body = parsed.data;
    if ((await countBusquedas(email)) >= LIMITS.busquedasPorCuenta) {
      throw new UserFacingError(`Llegaste a ${LIMITS.busquedasPorCuenta} búsquedas. Borrá alguna vieja para crear otra.`, "REC_MAX_BUSQUEDAS", 409);
    }
    const reads = body.referencia ? 2 : 1;
    await reserveAi(email, reads);
    try {
      const aviso = await avisoText(body.jobUrl, body.jobText);
      const { titulo, icp, preguntas } = await buildIcp({ brief: body.brief, aviso, referencia: body.referencia }, 1);
      const now = Date.now();
      const b: Busqueda = {
        id: newId(),
        owner: ownerId(email),
        titulo,
        brief: body.brief,
        aviso,
        icps: [icp],
        borrador: true,
        preguntas,
        fuentes: body.fuentes ?? { propios: true, maru: true },
        propuestas: [],
        creadaEn: now,
        actualizadaEn: now,
      };
      const saved = await saveBusqueda(b, now);
      return recJson({ busqueda: publicBusqueda(saved) }, 201);
    } catch (err) {
      await refundAi(email, reads).catch(() => {});
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
