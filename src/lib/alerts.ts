import { randomBytes } from "node:crypto";
import { getJson, sadd, setJson, smembers, srem } from "./db";
import { AREAS, MODALIDADES, NIVELES, type JobQuery } from "./jobFilters";

/**
 * Alertas de búsquedas nuevas (el "job alert" de jobright): la persona guarda una búsqueda con sus filtros
 * y una vez por día le mandamos por email las nuevas. Viven en la base: `alertas:<email>` y el índice `alertas:emails`.
 */

export type Alert = { id: string; query: Omit<JobQuery, "pagina">; createdAt: string; lastSentAt: string };

export const MAX_ALERTS = 5;
const key = (email: string) => `alertas:${email}`;
const INDEX = "alertas:emails";

export async function listAlerts(email: string): Promise<Alert[]> {
  return (await getJson<Alert[]>(key(email))) ?? [];
}

async function saveAlerts(email: string, alerts: Alert[]): Promise<void> {
  await setJson(key(email), alerts);
  if (alerts.length) await sadd(INDEX, email);
  else await srem(INDEX, email);
}

const same = (a: Alert["query"], b: Alert["query"]) => a.q.toLowerCase() === b.q.toLowerCase() && a.area === b.area && a.nivel === b.nivel && a.modalidad === b.modalidad && a.donde === b.donde;

export async function addAlert(email: string, query: Alert["query"], now = new Date()): Promise<Alert[] | "max"> {
  const alerts = await listAlerts(email);
  if (alerts.some((a) => same(a.query, query))) return alerts;
  if (alerts.length >= MAX_ALERTS) return "max";
  const next = [...alerts, { id: randomBytes(6).toString("hex"), query, createdAt: now.toISOString(), lastSentAt: now.toISOString() }];
  await saveAlerts(email, next);
  return next;
}

export async function removeAlert(email: string, id: string | null): Promise<Alert[]> {
  const next = id ? (await listAlerts(email)).filter((a) => a.id !== id) : [];
  await saveAlerts(email, next);
  return next;
}

export async function markSent(email: string, ids: string[], now = new Date()): Promise<void> {
  const alerts = await listAlerts(email);
  await saveAlerts(
    email,
    alerts.map((a) => (ids.includes(a.id) ? { ...a, lastSentAt: now.toISOString() } : a)),
  );
}

export const alertEmails = () => smembers(INDEX);

/** "Product Manager · Remoto · desde Argentina" */
export function describeQuery(q: Alert["query"]): string {
  const parts = [q.q && `“${q.q}”`, q.area && AREAS[q.area], q.nivel && NIVELES[q.nivel], q.modalidad && MODALIDADES[q.modalidad], q.donde === "ar" ? "desde Argentina" : "en todo el mundo"];
  return parts.filter(Boolean).join(" · ") || "Todas las búsquedas";
}

export function queryToSearch(q: Alert["query"]): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v && !(k === "donde" && v === "ar")) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `/busquedas?${s}` : "/busquedas";
}
