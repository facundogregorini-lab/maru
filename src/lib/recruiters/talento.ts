import { z } from "zod";
import { deleteKeys, getManyJson, setAdd, setJson, setMembers, setRemove } from "../db";
import { ProfileSchema, type Profile } from "../schemas";
import { userId } from "../sync/server";
import { perfilParaEvaluar } from "./logic";
import type { Icp } from "./types";

/**
 * Índice de talento: personas que usan Maru para buscar trabajo y activaron «Abierto a propuestas».
 * Las empresas ven su experiencia sin nombre completo ni contacto; el contacto se comparte cuando la persona
 * acepta una propuesta (docs/RECRUITERS.md). Apagar la opción borra el registro.
 */

export const TalentoPrefsSchema = z.object({
  objetivo: z.string().trim().max(300).default(""),
  roles: z.array(z.string().trim().max(80)).max(10).default([]),
  ciudad: z.string().trim().max(120).default(""),
  modalidades: z.array(z.string().trim().max(40)).max(5).default([]),
});
export type TalentoPrefs = z.infer<typeof TalentoPrefsSchema>;

export const TalentoPutSchema = z.discriminatedUnion("activo", [
  z.object({ activo: z.literal(true), profile: z.record(z.string(), z.unknown()), prefs: TalentoPrefsSchema.optional() }),
  z.object({ activo: z.literal(false) }),
]);

const str = (x: unknown, max = 2000) => (typeof x === "string" ? x.slice(0, max) : "");
const arr = (x: unknown, max = 60): unknown[] => (Array.isArray(x) ? x.slice(0, max) : []);
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});

/** El perfil guardado en el navegador puede venir de una versión vieja de Maru: se completa lo que falte. */
export function normalizeProfile(raw: Record<string, unknown>): Profile | null {
  const p = {
    nombre: str(raw.nombre, 120),
    titulo: str(raw.titulo, 300),
    ubicacion: str(raw.ubicacion, 200),
    email: str(raw.email, 254),
    telefono: str(raw.telefono, 60),
    linkedin_url: str(raw.linkedin_url, 300),
    otros_links: arr(raw.otros_links, 10).map((l) => str(l, 300)),
    resumen: str(raw.resumen, 4000),
    aptitudes: arr(raw.aptitudes).map((a) => str(a, 120)),
    experiencia: arr(raw.experiencia, 30).map((x) => {
      const e = obj(x);
      return { empresa: str(e.empresa, 200), cargo: str(e.cargo, 200), inicio: str(e.inicio, 20), fin: str(e.fin, 20), ubicacion: str(e.ubicacion, 200), descripcion: str(e.descripcion, 3000), logros: arr(e.logros, 30).map((l) => str(l, 1000)), fragmentos_incompletos: [] };
    }),
    educacion: arr(raw.educacion, 15).map((x) => {
      const e = obj(x);
      return { institucion: str(e.institucion, 200), titulo: str(e.titulo, 200), inicio: str(e.inicio, 20), fin: str(e.fin, 20) };
    }),
    idiomas: arr(raw.idiomas, 10).map((x) => ({ idioma: str(obj(x).idioma, 60), nivel: str(obj(x).nivel, 60) })),
    certificaciones: arr(raw.certificaciones, 20).map((x) => ({ nombre: str(obj(x).nombre, 200), emisor: str(obj(x).emisor, 200), anio: str(obj(x).anio, 10) })),
  };
  const ok = ProfileSchema.safeParse(p);
  return ok.success && (ok.data.experiencia.length || ok.data.titulo.trim()) ? ok.data : null;
}

export type Talento = {
  id: string;
  email: string;
  profile: Profile;
  prefs: TalentoPrefs;
  /** Texto que lee la IA de las empresas (sin nombre ni contacto). */
  perfil: string;
  activadoEn: number;
  actualizadoEn: number;
};

const KEY = (id: string) => `maru:talento:${id}`;
const INDEX = "maru:talento:activos";

export async function readTalento(email: string): Promise<Talento | null> {
  return (await getManyJson<Talento>([KEY(userId(email))]))[0];
}

export async function saveTalento(email: string, profile: Profile, prefs: TalentoPrefs, now = Date.now()): Promise<Talento> {
  const id = userId(email);
  const prev = await readTalento(email);
  const extra = [prefs.objetivo && `Busca: ${prefs.objetivo}`, prefs.roles.length && `Roles que le interesan: ${prefs.roles.join(", ")}`, prefs.modalidades.length && `Modalidad: ${prefs.modalidades.join(", ")}`]
    .filter(Boolean)
    .join("\n");
  const t: Talento = { id, email, profile, prefs, perfil: [perfilParaEvaluar(profile), extra].filter(Boolean).join("\n\n"), activadoEn: prev?.activadoEn ?? now, actualizadoEn: now };
  await setJson(KEY(id), t);
  await setAdd(INDEX, id);
  return t;
}

export async function removeTalento(email: string): Promise<void> {
  const id = userId(email);
  await deleteKeys([KEY(id)]);
  await setRemove(INDEX, id);
}

export async function readTalentos(ids: string[]): Promise<Talento[]> {
  const out: Talento[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = await getManyJson<Talento>(ids.slice(i, i + 100).map(KEY));
    for (const t of batch) if (t) out.push(t);
  }
  return out;
}

/** Hasta 3.000 perfiles por búsqueda rápida: alcanza de sobra para el arranque y acota la lectura. */
export async function allTalentos(max = 3000): Promise<Talento[]> {
  return readTalentos((await setMembers(INDEX)).slice(0, max));
}

/* ---------- Búsqueda rápida (sin IA, gratis) ---------- */

const STOP = new Set("de la el los las un una y o en con para por del al que se su sus a más 5 3 o años año experiencia equipo personas".split(" "));
export const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Puntaje por palabras del perfil ideal que aparecen en el perfil de la persona.
 * El puesto, las industrias de referencia y los excluyentes pesan más. La ubicación suma si coincide.
 * Es sólo un primer filtro: la lectura con IA es la que evalúa.
 */
export function quickScore(icp: Icp, t: Pick<Talento, "perfil" | "profile" | "prefs">): number {
  const text = new Set(tokens(`${t.perfil} ${t.prefs.ciudad}`));
  const hit = (s: string) => {
    const ws = tokens(s);
    return ws.length ? ws.filter((w) => text.has(w)).length / ws.length : 0;
  };
  let score = hit(icp.puesto) * 3 + hit(icp.referencias.join(" ")) * 1.5;
  for (const c of icp.obligatorios) score += hit(c.texto) * (c.peso === "excluyente" ? 2 : 1);
  for (const d of icp.deseables) score += hit(d.texto) * 0.5;
  if (icp.ubicacion && hit(icp.ubicacion) > 0) score += 1;
  return score;
}

export function quickMatches(icp: Icp, all: Talento[], exclude: Set<string>, max = 20): { talento: Talento; score: number }[] {
  return all
    .filter((t) => !exclude.has(t.id))
    .map((talento) => ({ talento, score: quickScore(icp, talento) }))
    .filter((m) => m.score >= 1.5)
    .sort((a, z) => z.score - a.score)
    .slice(0, max);
}
