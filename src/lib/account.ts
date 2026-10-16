import { dbEnabled, getJson, incr, run, setJson } from "./db";
import { FREE_MONTHLY_CREATIONS } from "./pricing";

export { FREE_MONTHLY_CREATIONS, PLAN_PRICE_ARS } from "./pricing";

/**
 * La cuenta de una persona (por email, el mismo del magic link o de Google) y su plan.
 * El plan lo escribe sólo el webhook de Mercado Pago; acá se lee para decidir los límites.
 */

export type PlanStatus = "authorized" | "pending" | "paused" | "cancelled";

export type Account = {
  email: string;
  name?: string;
  picture?: string;
  plan: "gratis" | "maru";
  /** Estado de la suscripción en Mercado Pago. */
  status?: PlanStatus;
  subscriptionId?: string;
  /** Cuándo empezó a pagar (para el botón de arrepentimiento: 10 días). */
  paidSince?: string;
  /** Si la dio de baja: hasta cuándo sigue el plan (el final del mes ya pagado). */
  paidUntil?: string;
  createdAt: string;
  updatedAt: string;
};


const key = (email: string) => `account:${email.toLowerCase()}`;

export async function getAccount(email: string): Promise<Account | null> {
  return getJson<Account>(key(email));
}

export async function upsertAccount(email: string, patch: Partial<Omit<Account, "email" | "createdAt">>): Promise<Account> {
  const now = new Date().toISOString();
  const prev = await getAccount(email);
  const next: Account = { plan: "gratis", createdAt: now, ...prev, ...patch, email: email.toLowerCase(), updatedAt: now };
  await setJson(key(email), next);
  return next;
}

export const isPaid = (a: Account | null, now = Date.now()) =>
  a?.plan === "maru" && (a.status === "authorized" || (!!a.paidUntil && Date.parse(a.paidUntil) > now));

/** El próximo "cumple mes" de la suscripción: hasta ahí está pago el plan. */
export function nextRenewal(paidSince: string, now = new Date()): string {
  const d = new Date(paidSince);
  while (d <= now) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/* ---------- uso del plan gratis ---------- */

const month = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const usageKey = (who: string, d?: Date) => `uso:${month(d)}:${who}`;
const MONTH_TTL = 35 * 24 * 3600;

export type Quota = { allowed: boolean; used: number; limit: number | null; paid: boolean };
export type Who = { email: string | null; ip: string };

/** `who` es el email si hay sesión; si no, la IP (así no se esquiva el límite sin cuenta). */
const whoId = (who: Who) => (who.email ? `e:${who.email.toLowerCase()}` : `ip:${who.ip}`);

/**
 * ¿Puede hacer una creación más (CV a medida, CV, carta, entrevista o video)?
 * Sin base de datos no hay límites: Maru se comporta como siempre.
 */
export async function checkCreation(who: Who): Promise<Quota> {
  if (!dbEnabled()) return { allowed: true, used: 0, limit: null, paid: false };
  if (who.email && isPaid(await getAccount(who.email))) return { allowed: true, used: 0, limit: null, paid: true };
  const used = Number((await run<string | null>(["GET", usageKey(whoId(who))])) ?? 0);
  return { allowed: used < FREE_MONTHLY_CREATIONS, used, limit: FREE_MONTHLY_CREATIONS, paid: false };
}

/** Descuenta una creación del plan gratis (se llama recién cuando la creación salió bien). */
export async function recordCreation(who: Who, quota: Quota): Promise<void> {
  if (!dbEnabled() || quota.paid) return;
  await incr(usageKey(whoId(who)), MONTH_TTL);
}
