import { randomBytes } from "node:crypto";
import { getManyJson, incrementWithTtl, deleteKeys, setAdd, setJson, setMembers, setRemove } from "../db";
import { userId } from "../sync/server";
import { LIMITS, type Busqueda, type Candidato } from "./types";

/**
 * Datos de Maru Recruiters en la base (Upstash, claves "maru:rec:…").
 * - maru:rec:b:<id>: la búsqueda (perfil ideal con su historial, preguntas, propuestas).
 * - maru:rec:b:<id>:c: conjunto con los ids de sus candidatos.
 * - maru:rec:c:<busqueda>:<candidato>: cada candidato con su evaluación y la decisión del reclutador.
 * - maru:rec:u:<cuenta>:b: las búsquedas de cada cuenta.
 */

export const newId = () => randomBytes(9).toString("base64url");
export const ownerId = (email: string) => userId(email);

const bKey = (id: string) => `maru:rec:b:${id}`;
const bCandKey = (id: string) => `maru:rec:b:${id}:c`;
const cKey = (b: string, c: string) => `maru:rec:c:${b}:${c}`;
const uKey = (owner: string) => `maru:rec:u:${owner}:b`;
const ID = /^[A-Za-z0-9_-]{6,40}$/;
export const validId = (id: string) => ID.test(id);

export async function readBusqueda(id: string): Promise<Busqueda | null> {
  if (!validId(id)) return null;
  return (await getManyJson<Busqueda>([bKey(id)]))[0];
}

/** La búsqueda si es de esa cuenta; null si no existe o es de otra (no se distingue, para no revelar ids ajenos). */
export async function readOwnBusqueda(id: string, email: string): Promise<Busqueda | null> {
  const b = await readBusqueda(id);
  return b && b.owner === ownerId(email) ? b : null;
}

export async function saveBusqueda(b: Busqueda, now = Date.now()): Promise<Busqueda> {
  const next = { ...b, actualizadaEn: now };
  await setJson(bKey(b.id), next);
  await setAdd(uKey(b.owner), b.id);
  return next;
}

export async function listBusquedas(email: string): Promise<Busqueda[]> {
  const ids = await setMembers(uKey(ownerId(email)));
  const all = await getManyJson<Busqueda>(ids.filter(validId).map(bKey));
  return all.filter((b): b is Busqueda => !!b).sort((a, z) => z.actualizadaEn - a.actualizadaEn);
}

export async function countBusquedas(email: string): Promise<number> {
  return (await setMembers(uKey(ownerId(email)))).length;
}

export async function deleteBusqueda(b: Busqueda): Promise<void> {
  const ids = await setMembers(bCandKey(b.id));
  await deleteKeys([bKey(b.id), bCandKey(b.id), ...ids.filter(validId).map((c) => cKey(b.id, c))]);
  await setRemove(uKey(b.owner), b.id);
}

export async function listCandidatos(busquedaId: string): Promise<Candidato[]> {
  const ids = await setMembers(bCandKey(busquedaId));
  const all = await getManyJson<Candidato>(ids.filter(validId).map((c) => cKey(busquedaId, c)));
  return all.filter((c): c is Candidato => !!c).sort((a, z) => a.agregadoEn - z.agregadoEn);
}

export async function readCandidato(busquedaId: string, id: string): Promise<Candidato | null> {
  if (!validId(id)) return null;
  return (await getManyJson<Candidato>([cKey(busquedaId, id)]))[0];
}

export async function countCandidatos(busquedaId: string): Promise<number> {
  return (await setMembers(bCandKey(busquedaId))).length;
}

export async function saveCandidato(c: Candidato): Promise<void> {
  await setJson(cKey(c.busquedaId, c.id), c);
  await setAdd(bCandKey(c.busquedaId), c.id);
}

export async function removeCandidato(busquedaId: string, id: string): Promise<void> {
  await deleteKeys([cKey(busquedaId, id)]);
  await setRemove(bCandKey(busquedaId), id);
}

/* ---------- Cupo diario de lecturas con IA ---------- */

/** Lecturas con IA por cuenta y por día (CV leído, perfil evaluado, perfil ideal o ajustes). Se cambia con RECRUITERS_DAILY_AI. */
export const dailyAiLimit = () => {
  const n = Number(process.env.RECRUITERS_DAILY_AI);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
};

const dayAr = (now: number) => new Date(now - 3 * 3600_000).toISOString().slice(0, 10);
const usoKey = (email: string, now: number) => `maru:rec:uso:${ownerId(email)}:${dayAr(now)}`;

/** Reserva `n` lecturas. false si con eso se pasa del cupo del día (y no reserva nada). */
export async function takeAi(email: string, n = 1, now = Date.now()): Promise<{ ok: boolean; used: number; limit: number }> {
  const limit = dailyAiLimit();
  const used = await incrementWithTtl(usoKey(email, now), n, 2 * 86400);
  if (used > limit) {
    await incrementWithTtl(usoKey(email, now), -n, 2 * 86400);
    return { ok: false, used: used - n, limit };
  }
  return { ok: true, used, limit };
}

/** Devuelve lecturas reservadas que no se usaron (por ejemplo, si la IA falló). */
export async function refundAi(email: string, n = 1, now = Date.now()): Promise<void> {
  await incrementWithTtl(usoKey(email, now), -n, 2 * 86400);
}

export const MAX_CANDIDATOS = LIMITS.candidatos;
