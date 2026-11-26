import { UserFacingError } from "../claude";
import { SITE_URL } from "../site";
import { draftGancho } from "./ai";
import { currentIcp, nombreCorto } from "./logic";
import {
  completeTask,
  dueMembers,
  outreachEmailConfigured,
  readInscripcion,
  readInscripciones,
  readSecuencia,
  runStep,
  saveInscripcion,
  scheduleAfter,
  suppress,
  taskText,
  waLink,
  whatsappConfigured,
  type Destino,
  type OutSender,
} from "./outreach";
import { readBusqueda, readCandidato, saveCandidato, takeAi, refundAi } from "./store";
import { readTalentos, removeTalento } from "./talento";
import type { Busqueda, Candidato, Inscripcion, Secuencia } from "./types";

/** A dónde se le escribe: el contacto del CV (postulantes propios) o, para candidatos de Maru, el email de su cuenta (nunca se muestra). */
export async function destinoDe(c: Candidato): Promise<Destino> {
  if (c.fuente === "maru") {
    const [t] = c.talentoId ? await readTalentos([c.talentoId]) : [];
    return { email: t?.email ?? "", telefono: "", linkedin: "" };
  }
  return { email: c.contacto.email, telefono: c.contacto.telefono, linkedin: c.contacto.linkedin };
}

const puestoDe = (b: Busqueda) => currentIcp(b).puesto || b.titulo;

/** Inscribe candidatos en la secuencia. La IA escribe la línea personal de cada uno (1 lectura). Con la secuencia activa, sale el primer paso. */
export async function enroll(o: { email: string; b: Busqueda; sec: Secuencia; candidatos: Candidato[]; now?: number; send?: OutSender }): Promise<number> {
  const now = o.now ?? Date.now();
  const icp = currentIcp(o.b);
  let n = 0;
  for (const c of o.candidatos.slice(0, 20)) {
    const prev = await readInscripcion(o.b.id, c.id);
    if (prev && prev.estado !== "cancelada") continue;
    const destino = await destinoDe(c);
    if (!destino.email && !destino.telefono && !destino.linkedin) continue;
    let gancho = "";
    if ((await takeAi(o.email)).ok) {
      try {
        gancho = await draftGancho(icp, c);
      } catch {
        await refundAi(o.email).catch(() => {});
      }
    }
    let insc: Inscripcion = { busquedaId: o.b.id, candidatoId: c.id, estado: o.sec.activa ? "activa" : "pausada", paso: 0, proximoEn: scheduleAfter(now, o.sec.pasos[0].dias), gancho, historial: [], creadaEn: now, actualizadaEn: now };
    if (insc.estado === "activa" && insc.proximoEn <= now) insc = await runStep({ insc, sec: o.sec, candidato: c, destino, puesto: puestoDe(o.b), replyTo: o.sec.replyTo, owner: o.b.owner, now, send: o.send });
    await saveInscripcion(insc);
    n++;
  }
  return n;
}

/** Al activar la secuencia, las inscripciones en pausa arrancan; las que ya tocan salen ahora (hasta 20; el resto, con el envío diario). */
export async function activate(o: { b: Busqueda; sec: Secuencia; now?: number; send?: OutSender }): Promise<void> {
  const now = o.now ?? Date.now();
  let inmediatas = 0;
  for (const i of await readInscripciones(o.b.id)) {
    if (i.estado !== "pausada") continue;
    let insc: Inscripcion = { ...i, estado: "activa", proximoEn: i.proximoEn || now, actualizadaEn: now };
    const c = await readCandidato(o.b.id, i.candidatoId);
    if (c && insc.proximoEn <= now && inmediatas < 20) {
      insc = await runStep({ insc, sec: o.sec, candidato: c, destino: await destinoDe(c), puesto: puestoDe(o.b), replyTo: o.sec.replyTo, owner: o.b.owner, now, send: o.send });
      inmediatas++;
    }
    await saveInscripcion(insc);
  }
}

export async function pauseAll(b: Busqueda): Promise<void> {
  for (const i of await readInscripciones(b.id)) if (i.estado === "activa") await saveInscripcion({ ...i, estado: "pausada", actualizadaEn: Date.now() });
}

export async function setEstado(b: Busqueda, candidatoId: string, estado: "activa" | "pausada" | "cancelada" | "respondio"): Promise<void> {
  const i = await readInscripcion(b.id, candidatoId);
  if (!i) throw new UserFacingError("Ese candidato no está en la secuencia.", "NOT_FOUND", 404);
  await saveInscripcion({ ...i, estado, actualizadaEn: Date.now(), ...(estado === "activa" && !i.proximoEn ? { proximoEn: Date.now() } : {}) });
}

export async function taskDone(b: Busqueda, sec: Secuencia, candidatoId: string): Promise<void> {
  const i = await readInscripcion(b.id, candidatoId);
  if (!i || i.estado !== "tarea") throw new UserFacingError("Esa tarea ya no está pendiente.", "GONE", 409);
  await saveInscripcion(completeTask({ ...i, estado: sec.activa ? "activa" : "pausada" }, sec));
}

/** Envío diario (cron): los pasos que vencieron. Devuelve cuántos procesó. */
export async function processDue(o: { now?: number; max?: number; send?: OutSender } = {}): Promise<{ procesados: number; enviados: number }> {
  const now = o.now ?? Date.now();
  let procesados = 0;
  let enviados = 0;
  const cache = new Map<string, { b: Busqueda | null; sec: Secuencia | null }>();
  for (const member of await dueMembers()) {
    if (procesados >= (o.max ?? 200)) break;
    const [bid, cid] = member.split(":");
    if (!bid || !cid) continue;
    const i = await readInscripcion(bid, cid);
    if (!i || i.estado !== "activa" || i.proximoEn > now) continue;
    if (!cache.has(bid)) cache.set(bid, { b: await readBusqueda(bid), sec: await readSecuencia(bid) });
    const { b, sec } = cache.get(bid)!;
    const c = b ? await readCandidato(bid, cid) : null;
    if (!b || !sec || !c) {
      await saveInscripcion({ ...i, estado: "cancelada", actualizadaEn: now });
      continue;
    }
    if (!sec.activa) continue;
    const next = await runStep({ insc: i, sec, candidato: c, destino: await destinoDe(c), puesto: puestoDe(b), replyTo: sec.replyTo, owner: b.owner, now, send: o.send });
    if (next.historial.length > i.historial.length && next.historial.at(-1)?.ok) enviados++;
    await saveInscripcion(next);
    procesados++;
  }
  return { procesados, enviados };
}

/** Lo que ve el reclutador de cada inscripción, con el texto listo para las tareas manuales. */
export async function outreachView(b: Busqueda, cs: Candidato[]) {
  const sec = await readSecuencia(b.id);
  const ins = sec ? await readInscripciones(b.id) : [];
  const byId = new Map(cs.map((c) => [c.id, c]));
  const puesto = puestoDe(b);
  return {
    secuencia: sec ? { pasos: sec.pasos, remitente: sec.remitente, empresa: sec.empresa, autoSi: sec.autoSi, activa: sec.activa, actualizadaEn: sec.actualizadaEn } : null,
    inscripciones: ins
      .filter((i) => byId.has(i.candidatoId))
      .map((i) => {
        const c = byId.get(i.candidatoId)!;
        const paso = sec?.pasos[i.paso];
        const texto = sec && i.estado === "tarea" ? taskText(i, sec, c, puesto) : "";
        return {
          candidatoId: i.candidatoId,
          estado: i.estado,
          paso: i.paso,
          proximoEn: i.proximoEn,
          gancho: i.gancho,
          historial: i.historial,
          tarea: i.estado === "tarea" && paso ? { canal: paso.canal, texto, whatsapp: paso.canal === "whatsapp" && c.fuente === "propio" ? waLink(c.contacto.telefono, texto) : null, linkedin: paso.canal === "linkedin" ? c.contacto.linkedin : null } : null,
        };
      }),
    configuracion: { email: outreachEmailConfigured(), whatsapp: whatsappConfigured() },
  };
}

/* ---------- Respuesta del candidato (links del mail) ---------- */

export type Respuesta = "si" | "no" | "baja";

/** «Me interesa», «No, gracias» o la baja. Con «Me interesa», el reclutador recibe el aviso y, si es de Maru, su nombre y email. */
export async function respond(o: { busquedaId: string; candidatoId: string; r: Respuesta; notify?: (to: string, subject: string, text: string) => Promise<boolean> }): Promise<{ empresa: string; ok: boolean }> {
  const [i, b, sec, c] = await Promise.all([readInscripcion(o.busquedaId, o.candidatoId), readBusqueda(o.busquedaId), readSecuencia(o.busquedaId), readCandidato(o.busquedaId, o.candidatoId)]);
  if (!i || !b || !sec || !c) return { empresa: sec?.empresa ?? "", ok: false };
  const now = Date.now();
  const destino = await destinoDe(c);
  if (o.r === "baja") {
    if (destino.email) await suppress(destino.email);
    if (c.fuente === "maru" && destino.email) await removeTalento(destino.email);
    await saveInscripcion({ ...i, estado: "baja", actualizadaEn: now });
    return { empresa: sec.empresa, ok: true };
  }
  if (o.r === "no") {
    await saveInscripcion({ ...i, estado: "no_interesado", actualizadaEn: now });
    return { empresa: sec.empresa, ok: true };
  }
  const yaAvisado = i.estado === "interesado";
  await saveInscripcion({ ...i, estado: "interesado", actualizadaEn: now });
  let nombre = c.nombre;
  if (c.fuente === "maru" && c.talentoId) {
    const [t] = await readTalentos([c.talentoId]);
    if (t) {
      nombre = t.profile.nombre || nombreCorto(c.nombre);
      await saveCandidato({ ...c, nombre, contactoCompartido: true, contacto: { email: t.email, telefono: t.profile.telefono, linkedin: t.profile.linkedin_url } });
    }
  }
  if (!yaAvisado && o.notify) {
    const link = `${SITE_URL}/recruiters/${b.id}`;
    await o.notify(sec.replyTo, `${nombre} está interesado/a en ${puestoDe(b)}`, `${nombre} tocó «Me interesa» en tu mensaje por la búsqueda ${b.titulo}.${destino.email ? `\n\nEmail: ${destino.email}` : ""}\n\nVer la búsqueda: ${link}`).catch(() => false);
  }
  return { empresa: sec.empresa, ok: true };
}
