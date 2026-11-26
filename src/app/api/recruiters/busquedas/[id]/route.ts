import { UserFacingError, errorResponse } from "@/lib/claude";
import { buildIcp, evaluar, extractProfile, proponer } from "@/lib/recruiters/ai";
import { recJson, recruiterEmail, reserveAi } from "@/lib/recruiters/http";
import { MIN_CALIFICADOS, applyEdit, applyPropuestas, calificados, candidatoFromProfile, currentIcp, pendientes, publicBusqueda, publicCandidato, versiones } from "@/lib/recruiters/logic";
import { MAX_CANDIDATOS, countCandidatos, deleteBusqueda, listCandidatos, readCandidato, readOwnBusqueda, refundAi, removeCandidato, saveBusqueda, saveCandidato } from "@/lib/recruiters/store";
import { allTalentos, quickMatches, readTalentos } from "@/lib/recruiters/talento";
import { AccionSchema, type Busqueda, type Candidato } from "@/lib/recruiters/types";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => new UserFacingError("No encontramos esa búsqueda.", "NOT_FOUND", 404);

/** Candidatos de Maru que apagaron «Abierto a propuestas»: dejan de verse en las búsquedas. */
async function visibles(busquedaId: string): Promise<Candidato[]> {
  const cs = await listCandidatos(busquedaId);
  const ids = cs.flatMap((c) => (c.fuente === "maru" && c.talentoId ? [c.talentoId] : []));
  if (!ids.length) return cs;
  const activos = new Set((await readTalentos(ids)).map((t) => t.id));
  const fuera = cs.filter((c) => c.fuente === "maru" && !(c.talentoId && activos.has(c.talentoId)));
  // Se borran de la búsqueda: la persona retiró su consentimiento.
  for (const c of fuera) await removeCandidato(busquedaId, c.id);
  return cs.filter((c) => !fuera.includes(c));
}

async function snapshot(b: Busqueda, extra: Record<string, unknown> = {}) {
  const cs = await visibles(b.id);
  const icp = currentIcp(b);
  return {
    busqueda: publicBusqueda(b),
    candidatos: cs.map(publicCandidato),
    versiones: versiones(b, cs),
    pendientes: b.borrador ? 0 : pendientes(icp, cs).length,
    calificados: calificados(cs).length,
    minCalificados: MIN_CALIFICADOS,
    ...extra,
  };
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const email = recruiterEmail(req);
    const b = await readOwnBusqueda((await params).id, email);
    if (!b) throw notFound();
    return recJson(await snapshot(b));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const email = recruiterEmail(req);
    const b = await readOwnBusqueda((await params).id, email);
    if (!b) throw notFound();
    await deleteBusqueda(b);
    return recJson({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Evalúa un candidato con IA, devolviendo la lectura al cupo si la IA falla. */
async function evaluarUno(email: string, b: Busqueda, c: Candidato): Promise<Candidato> {
  await reserveAi(email);
  try {
    const evaluacion = await evaluar(currentIcp(b), c);
    const next = { ...c, evaluacion };
    await saveCandidato(next);
    return next;
  } catch (err) {
    await refundAi(email).catch(() => {});
    throw err;
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const email = recruiterEmail(req);
    const b = await readOwnBusqueda((await params).id, email);
    if (!b) throw notFound();
    const parsed = AccionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new UserFacingError("No pudimos leer el pedido. Recargá la página y probá de nuevo.", "BAD_REQUEST");
    const a = parsed.data;

    switch (a.accion) {
      case "editar_icp": {
        if (!a.icp.obligatorios.length) throw new UserFacingError("El perfil ideal necesita al menos un requisito obligatorio.", "ICP_EMPTY", 422);
        await saveBusqueda(applyEdit(b, a.icp));
        break;
      }
      case "responder": {
        const pregunta = b.preguntas.find((p) => p.id === a.preguntaId);
        if (!pregunta) throw new UserFacingError("Esa pregunta ya se respondió.", "GONE", 409);
        if (!b.borrador) throw new UserFacingError("El perfil ideal ya está aprobado. Editalo directamente.", "ICP_APPROVED", 409);
        await reserveAi(email);
        try {
          const cur = currentIcp(b);
          const { icp } = await buildIcp({ brief: b.brief, aviso: b.aviso, anterior: cur, respuestas: [{ pregunta: pregunta.texto, respuesta: a.respuesta }] }, cur.version);
          await saveBusqueda({ ...b, icps: [...b.icps.slice(0, -1), icp], preguntas: b.preguntas.filter((p) => p.id !== pregunta.id) });
        } catch (err) {
          await refundAi(email).catch(() => {});
          throw err;
        }
        break;
      }
      case "aprobar": {
        await saveBusqueda({ ...b, borrador: false, preguntas: [] });
        break;
      }
      case "agregar_cv": {
        if ((await countCandidatos(b.id)) >= MAX_CANDIDATOS) throw new UserFacingError(`Esta búsqueda ya tiene ${MAX_CANDIDATOS} candidatos.`, "REC_MAX_CANDIDATOS", 409);
        await reserveAi(email);
        let c: Candidato;
        try {
          const profile = await extractProfile(a.source);
          c = candidatoFromProfile(b.id, profile, "propio");
          await saveCandidato(c);
        } catch (err) {
          await refundAi(email).catch(() => {});
          throw err;
        }
        // Con el perfil aprobado, se evalúa enseguida. Si falla la evaluación, el CV queda cargado y pendiente.
        if (!b.borrador) await evaluarUno(email, b, c).catch(() => null);
        break;
      }
      case "evaluar": {
        if (b.borrador) throw new UserFacingError("Aprobá el perfil ideal antes de evaluar.", "ICP_DRAFT", 409);
        const todos = pendientes(currentIcp(b), await visibles(b.id));
        for (const c of todos.slice(0, a.max ?? 3)) await evaluarUno(email, b, c);
        break;
      }
      case "calificar": {
        const c = await readCandidato(b.id, a.candidatoId);
        if (!c) throw new UserFacingError("No encontramos ese candidato.", "NOT_FOUND", 404);
        const decision = a.decision;
        await saveCandidato({
          ...c,
          decision,
          motivo: decision === "no" || decision === "tal" ? (a.motivo ?? c.motivo) : "",
          decididoEn: decision ? Date.now() : null,
          decididoConVersion: decision ? (c.evaluacion?.icpVersion ?? currentIcp(b).version) : null,
        });
        break;
      }
      case "proponer": {
        const cs = await listCandidatos(b.id);
        if (calificados(cs).length < MIN_CALIFICADOS) throw new UserFacingError(`Calificá al menos ${MIN_CALIFICADOS} candidatos para que Maru proponga ajustes.`, "REC_FEW_RATINGS", 409);
        await reserveAi(email);
        try {
          const propuestas = await proponer(b, currentIcp(b), cs);
          await saveBusqueda({ ...b, propuestas });
        } catch (err) {
          await refundAi(email).catch(() => {});
          throw err;
        }
        break;
      }
      case "aplicar": {
        if (!b.propuestas.length) throw new UserFacingError("No hay ajustes para aplicar.", "GONE", 409);
        await saveBusqueda(applyPropuestas(b, a.aceptadas));
        break;
      }
      case "borrar_candidato": {
        await removeCandidato(b.id, a.candidatoId);
        break;
      }
      case "buscar_maru": {
        if (b.borrador) throw new UserFacingError("Aprobá el perfil ideal antes de buscar.", "ICP_DRAFT", 409);
        const cs = await listCandidatos(b.id);
        const ya = new Set(cs.flatMap((c) => (c.talentoId ? [c.talentoId] : [])));
        const lugar = Math.max(0, MAX_CANDIDATOS - cs.length);
        const matches = quickMatches(currentIcp(b), await allTalentos(), ya, Math.min(20, lugar));
        for (const m of matches) await saveCandidato(candidatoFromProfile(b.id, m.talento.profile, "maru", Date.now(), m.talento.id));
        const fresh = await readOwnBusqueda(b.id, email);
        if (!fresh) throw notFound();
        return recJson(await snapshot(fresh, { encontrados: matches.length }));
      }
    }
    const fresh = await readOwnBusqueda(b.id, email);
    if (!fresh) throw notFound();
    return recJson(await snapshot(fresh));
  } catch (err) {
    return errorResponse(err);
  }
}
