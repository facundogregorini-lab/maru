import type { Profile } from "../schemas";
import { newId } from "./store";
import {
  LIMITS,
  type Busqueda,
  type Candidato,
  type Categoria,
  type Criterio,
  type EvalDraft,
  type Evaluacion,
  type Icp,
  type IcpDraft,
  type IcpEdit,
  type Item,
  type Pregunta,
  type Propuesta,
  type PropuestasDraft,
} from "./types";

const clip = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const nonEmpty = (s: string) => s.replace(/\s+/g, " ").trim().length > 0;

/** El borrador de la IA pasa a ICP con ids propios y los topes aplicados. */
export function icpFromDraft(d: IcpDraft, version: number, now = Date.now()): Icp {
  return {
    version,
    puesto: clip(d.puesto, 200),
    resumen: clip(d.resumen, 600),
    obligatorios: d.obligatorios.filter((c) => nonEmpty(c.texto)).slice(0, LIMITS.obligatorios).map((c) => ({ id: newId(), texto: clip(c.texto, LIMITS.criterio), peso: c.peso, origen: c.origen })),
    deseables: d.deseables.filter((c) => nonEmpty(c.texto)).slice(0, LIMITS.deseables).map((c) => ({ id: newId(), texto: clip(c.texto, LIMITS.criterio) })),
    evitar: d.evitar.filter((c) => nonEmpty(c.texto)).slice(0, LIMITS.evitar).map((c) => ({ id: newId(), texto: clip(c.texto, LIMITS.criterio) })),
    referencias: d.referencias.map((r) => clip(r, 80)).filter(Boolean).slice(0, LIMITS.referencias),
    seniority: clip(d.seniority, 120),
    ubicacion: clip(d.ubicacion, 200),
    creadoEn: now,
  };
}

export function preguntasFromDraft(d: IcpDraft): Pregunta[] {
  return d.preguntas
    .filter((p) => nonEmpty(p.texto))
    .slice(0, 2)
    .map((p) => ({ id: newId(), texto: clip(p.texto, 300), opciones: p.opciones.map((o) => clip(o, 80)).filter(Boolean).slice(0, 3) }));
}

export const currentIcp = (b: Busqueda): Icp => b.icps[b.icps.length - 1];

/**
 * Una edición a mano del reclutador. Si la versión vigente todavía es borrador, se reemplaza;
 * si ya se aprobó (y hay evaluaciones hechas con ella), nace una versión nueva.
 */
export function applyEdit(b: Busqueda, edit: IcpEdit, now = Date.now()): Busqueda {
  const cur = currentIcp(b);
  const ids = (xs: { id: string }[]) => xs.map((x) => (x.id.startsWith("nuevo") ? { ...x, id: newId() } : x));
  const next: Icp = {
    ...edit,
    obligatorios: ids(edit.obligatorios) as Criterio[],
    deseables: ids(edit.deseables) as Item[],
    evitar: ids(edit.evitar) as Item[],
    version: b.borrador ? cur.version : cur.version + 1,
    creadoEn: now,
  };
  const icps = b.borrador ? [...b.icps.slice(0, -1), next] : [...b.icps, next];
  return { ...b, icps, borrador: true, propuestas: [] };
}

/**
 * La categoría sale de los criterios, no de la IA: así es la misma regla para todos y se puede explicar.
 * - inconcluso: el perfil no permite evaluar la mitad o más de los obligatorios.
 * - fuerte: cumple todos los excluyentes y casi todos los importantes, sin señales de perfil a evitar.
 * - bueno: cumple los excluyentes y la mayoría del resto.
 * - parcial: le falta algún excluyente pero cumple la mitad o más.
 * - bajo: el resto.
 */
export function categoriaDe(icp: Icp, criterios: { id: string; estado: string }[], evitarCoincide: number): Categoria {
  const estado = new Map(criterios.map((c) => [c.id, c.estado]));
  const obl = icp.obligatorios;
  if (!obl.length) return "inconcluso";
  const of = (c: Criterio) => estado.get(c.id) ?? "sin_datos";
  const sinDatos = obl.filter((c) => of(c) === "sin_datos").length;
  if (sinDatos * 2 >= obl.length) return "inconcluso";
  const excl = obl.filter((c) => c.peso === "excluyente");
  const imp = obl.filter((c) => c.peso === "importante");
  const exclOk = excl.every((c) => of(c) === "cumple");
  const impOk = imp.filter((c) => of(c) === "cumple").length;
  const total = obl.filter((c) => of(c) === "cumple").length;
  if (exclOk) {
    if (evitarCoincide === 0 && (imp.length === 0 || impOk >= Math.ceil(imp.length * 0.75))) return "fuerte";
    return impOk * 2 >= imp.length ? "bueno" : "parcial";
  }
  return total * 2 >= obl.length ? "parcial" : "bajo";
}

/** La salida de la IA se acota a los criterios que existen: un id inventado no entra. */
export function evaluacionFromDraft(icp: Icp, d: EvalDraft, now = Date.now()): Evaluacion {
  const byId = new Map(d.criterios.map((c) => [c.id, c]));
  const criterios = icp.obligatorios.map((c) => {
    const e = byId.get(c.id);
    return { id: c.id, estado: e?.estado ?? "sin_datos", evidencia: clip(e?.evidencia ?? "", 240) };
  });
  const desById = new Map(d.deseables.map((c) => [c.id, c.estado]));
  const deseables = icp.deseables.map((c) => ({ id: c.id, estado: desById.get(c.id) ?? "sin_datos" }));
  const evitarIds = new Set(icp.evitar.map((e) => e.id));
  const evitarCoincide = d.evitar.filter((e) => e.coincide && evitarIds.has(e.id)).length;
  return {
    icpVersion: icp.version,
    categoria: categoriaDe(icp, criterios, evitarCoincide),
    porQue: clip(d.por_que, 400),
    criterios,
    deseables,
    alertas: d.alertas.map((a) => clip(a, 200)).filter(Boolean).slice(0, 3),
    evaluadoEn: now,
  };
}

/** Lo que lee la IA del candidato: experiencia, estudios y aptitudes. Sin nombre, contacto ni foto. */
export function perfilParaEvaluar(p: Profile): string {
  const out: string[] = [];
  if (p.titulo) out.push(`Titular: ${p.titulo}`);
  if (p.ubicacion) out.push(`Ubicación: ${p.ubicacion}`);
  if (p.resumen) out.push("", "RESUMEN", p.resumen);
  if (p.experiencia.length) {
    out.push("", "EXPERIENCIA");
    for (const e of p.experiencia) {
      out.push(`${e.cargo} — ${e.empresa}${e.ubicacion ? `, ${e.ubicacion}` : ""} (${[e.inicio, e.fin].filter(Boolean).join(" – ")})`);
      if (e.descripcion) out.push(e.descripcion);
      for (const l of e.logros) out.push(`• ${l}`);
    }
  }
  if (p.educacion.length) {
    out.push("", "EDUCACIÓN");
    for (const ed of p.educacion) out.push(`${ed.titulo} — ${ed.institucion} (${[ed.inicio, ed.fin].filter(Boolean).join(" – ")})`);
  }
  if (p.aptitudes.length) out.push("", "APTITUDES", p.aptitudes.join(", "));
  if (p.idiomas.length) out.push("", "IDIOMAS", p.idiomas.map((l) => (l.nivel ? `${l.idioma} (${l.nivel})` : l.idioma)).join(", "));
  if (p.certificaciones.length) out.push("", "CERTIFICACIONES", ...p.certificaciones.map((c) => [c.nombre, c.emisor, c.anio].filter(Boolean).join(" · ")));
  return out.join("\n").trim().slice(0, 20_000);
}

/** "Martina Rodríguez" → "Martina R.": para candidatos de Maru, que comparten el nombre completo al aceptar. */
export function nombreCorto(nombre: string): string {
  const parts = nombre.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!parts.length) return "Candidato/a";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function candidatoFromProfile(busquedaId: string, p: Profile, fuente: Candidato["fuente"], now = Date.now(), talentoId?: string): Candidato {
  const actual = p.experiencia.find((e) => /actual/i.test(e.fin)) ?? p.experiencia[0];
  const titular = clip(p.titulo || (actual ? `${actual.cargo} · ${actual.empresa}` : ""), 200);
  return {
    id: newId(),
    busquedaId,
    fuente,
    nombre: clip(fuente === "maru" ? nombreCorto(p.nombre) : p.nombre || "Sin nombre", 120),
    titular,
    ubicacion: clip(p.ubicacion, 120),
    perfil: perfilParaEvaluar(p),
    contacto: fuente === "propio" ? { email: clip(p.email, 254), telefono: clip(p.telefono, 40), linkedin: clip(p.linkedin_url, 300) } : { email: "", telefono: "", linkedin: "" },
    ...(talentoId ? { talentoId } : {}),
    evaluacion: null,
    decision: null,
    motivo: "",
    decididoEn: null,
    decididoConVersion: null,
    agregadoEn: now,
  };
}

/** Candidatos que necesitan (re)evaluación con la versión vigente del perfil ideal. */
export const pendientes = (icp: Icp, cs: Candidato[]) => cs.filter((c) => c.evaluacion?.icpVersion !== icp.version);

/** Hacen falta 5 calificaciones para proponer ajustes (con menos no hay patrón). */
export const MIN_CALIFICADOS = 5;
export const calificados = (cs: Candidato[]) => cs.filter((c) => c.decision);

/* ---------- Ajustes propuestos ---------- */

export function propuestasFromDraft(icp: Icp, d: PropuestasDraft): Propuesta[] {
  const ids = new Set(icp.obligatorios.map((c) => c.id));
  const necesitaCriterio = new Set(["quitar_obligatorio", "cambiar_peso", "editar_obligatorio"]);
  return d.propuestas
    .filter((p) => (necesitaCriterio.has(p.tipo) ? ids.has(p.criterio_id) : true))
    .filter((p) => p.tipo === "quitar_obligatorio" || nonEmpty(p.despues) || p.tipo === "cambiar_peso")
    .slice(0, 4)
    .map((p) => ({
      id: newId(),
      tipo: p.tipo,
      criterioId: necesitaCriterio.has(p.tipo) ? p.criterio_id : "",
      antes: clip(p.antes, LIMITS.criterio),
      despues: clip(p.despues, LIMITS.criterio),
      peso: p.peso === "ninguno" ? null : p.peso,
      porQue: clip(p.por_que, 400),
    }));
}

/** Versión nueva del perfil ideal con los ajustes aceptados. Queda aprobada: el reclutador ya eligió los cambios. */
export function applyPropuestas(b: Busqueda, aceptadas: string[], now = Date.now()): Busqueda {
  const cur = currentIcp(b);
  const elegidas = b.propuestas.filter((p) => aceptadas.includes(p.id));
  let obligatorios = cur.obligatorios.map((c) => ({ ...c }));
  const deseables = cur.deseables.map((c) => ({ ...c }));
  const evitar = cur.evitar.map((c) => ({ ...c }));
  for (const p of elegidas) {
    if (p.tipo === "quitar_obligatorio") obligatorios = obligatorios.filter((c) => c.id !== p.criterioId);
    else if (p.tipo === "cambiar_peso") obligatorios = obligatorios.map((c) => (c.id === p.criterioId && p.peso ? { ...c, peso: p.peso, origen: "ajuste" as const } : c));
    else if (p.tipo === "editar_obligatorio") obligatorios = obligatorios.map((c) => (c.id === p.criterioId ? { ...c, texto: p.despues, peso: p.peso ?? c.peso, origen: "ajuste" as const } : c));
    else if (p.tipo === "agregar_obligatorio" && obligatorios.length < LIMITS.obligatorios) obligatorios.push({ id: newId(), texto: p.despues, peso: p.peso ?? "importante", origen: "ajuste" });
    else if (p.tipo === "agregar_deseable" && deseables.length < LIMITS.deseables) deseables.push({ id: newId(), texto: p.despues });
    else if (p.tipo === "agregar_evitar" && evitar.length < LIMITS.evitar) evitar.push({ id: newId(), texto: p.despues });
  }
  const next: Icp = { ...cur, obligatorios, deseables, evitar, version: cur.version + 1, creadoEn: now };
  return { ...b, icps: [...b.icps, next], borrador: false, propuestas: [] };
}

/* ---------- Lo que ve el navegador ---------- */

/** Resultados por versión del perfil ideal: cuántos se calificaron y cuántos Sí. */
export function versiones(b: Busqueda, cs: Candidato[]) {
  return b.icps.map((icp) => {
    const con = cs.filter((c) => c.decididoConVersion === icp.version);
    return { version: icp.version, creadoEn: icp.creadoEn, calificados: con.length, si: con.filter((c) => c.decision === "si").length };
  });
}

export function publicBusqueda(b: Busqueda) {
  const { owner: _owner, ...rest } = b;
  void _owner;
  return rest;
}

/** Sin el texto completo del perfil (pesa) y, para candidatos de Maru, sin contacto. */
export function publicCandidato(c: Candidato) {
  const { perfil, ...rest } = c;
  return { ...rest, perfilResumen: perfil.slice(0, 1500), contacto: c.fuente === "maru" ? null : c.contacto };
}
