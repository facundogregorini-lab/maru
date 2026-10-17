import { dbConfigured, keyExists, setIfAbsent } from "../db";
import { userId } from "../sync/server";

/**
 * Hitos de conversión ya enviados a Google Ads, por cuenta (Redis). Así una cuenta cuenta una sola
 * activación y un solo primer límite aunque cambie de navegador o dispositivo, sin mandarle su identidad
 * a Google: la clave usa el mismo hash del email que el resto de la cuenta y nunca sale del servidor.
 */
export type Milestone = "activation" | "paywall" | "begin_checkout" | "purchase";
export const MILESTONES: Milestone[] = ["activation", "paywall", "begin_checkout", "purchase"];
export const isMilestone = (v: unknown): v is Milestone => typeof v === "string" && (MILESTONES as string[]).includes(v);

/** Los hitos únicos por cuenta no vencen; los de una operación se deduplican por su id. */
const NEEDS_ID: Record<Milestone, boolean> = { activation: false, paywall: false, begin_checkout: true, purchase: true };
const TTL_MS: Record<Milestone, number | undefined> = { activation: undefined, paywall: undefined, begin_checkout: 120 * 86400_000, purchase: 400 * 86400_000 };
const OP_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function milestoneKey(email: string, milestone: Milestone, id?: string): string | null {
  if (NEEDS_ID[milestone] !== !!id) return null;
  if (id && !OP_ID.test(id)) return null;
  return `maru:conv:${userId(email)}:${milestone}${id ? `:${id}` : ""}`;
}

export type ClaimMode = "claim" | "check" | "mark";
/**
 * - claim: marca el hito y devuelve first=true sólo la primera vez (atómico: SET NX).
 * - check: sólo consulta (modo de prueba: no consume el hito de producción).
 * - mark: lo marca sin pedir envío (p. ej. ya se envió antes de ingresar, desde este navegador).
 */
export async function claimMilestone(email: string, milestone: Milestone, id: string | undefined, mode: ClaimMode, now = Date.now()): Promise<{ first: boolean }> {
  if (!dbConfigured()) throw new Error("Sin base de datos.");
  const key = milestoneKey(email, milestone, id);
  if (!key) throw new Error("Hito inválido.");
  if (mode === "check") return { first: !(await keyExists(key, now)) };
  const first = await setIfAbsent(key, { at: now }, TTL_MS[milestone], now);
  return { first: mode === "claim" ? first : false };
}
