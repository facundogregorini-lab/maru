import { z } from "zod";
import { MAX_ALERT_SCORE, MIN_ALERT_SCORE, type AlertView } from "./alertsShared";
import { signValue, verifySignedValue } from "./auth";
import { getManyJson, setAdd, setJson, setMembers, setRemove } from "./db";
import { FiltersSchema, InteractionsSchema, MatchPrefsSchema, MatchProfileSchema } from "./match/api-schemas";
import { rankOpportunities, type Filters, type RankedItem } from "./match/ranking";
import type { Interactions, MatchPrefs, MatchProfile, Opportunity, StoredPosting } from "./match/types";
import { SITE_URL } from "./site";
import { userId } from "./sync/server";

/**
 * Alertas semanales (plan pago): cada lunes, las búsquedas nuevas para vos que superan tu % mínimo,
 * con los filtros que elegiste en el match. Se mandan con Resend; sin RESEND_API_KEY se configuran igual
 * y el envío queda en pausa. Cada mail trae un link para darse de baja sin ingresar.
 */

/** Búsquedas por mail: alcanza para elegir sin que sea una lista eterna. */
export const ALERT_JOBS = 8;
/** Las ya enviadas no se repiten; se recuerdan las últimas. */
const SENT_MEMORY = 400;

const INDEX = "maru:alertas";
const keyFor = (uid: string) => `maru:alerta:${uid}`;

export const AlertSettingsSchema = z.object({
  active: z.boolean(),
  minScore: z.number().int().min(MIN_ALERT_SCORE).max(MAX_ALERT_SCORE),
  filters: FiltersSchema,
  profile: MatchProfileSchema,
  prefs: MatchPrefsSchema,
  interactions: InteractionsSchema,
});
export type AlertSettings = z.infer<typeof AlertSettingsSchema>;

export type StoredAlert = {
  email: string;
  active: boolean;
  minScore: number;
  filters: Filters;
  profile: MatchProfile;
  prefs: MatchPrefs;
  interactions: Interactions;
  updatedAt: number;
  lastSentAt: number | null;
  sentIds: string[];
};

export const alertView = (a: StoredAlert | null): AlertView | null =>
  a && { active: a.active, minScore: a.minScore, filters: a.filters ?? {}, lastSentAt: a.lastSentAt };

export async function readAlert(email: string): Promise<StoredAlert | null> {
  const [a] = await getManyJson<StoredAlert>([keyFor(userId(email))]);
  return a;
}

export async function saveAlert(email: string, s: AlertSettings, now = Date.now()): Promise<StoredAlert> {
  const uid = userId(email);
  const prev = await readAlert(email);
  const next: StoredAlert = {
    email: email.trim().toLowerCase(),
    active: s.active,
    minScore: s.minScore,
    filters: s.filters ?? {},
    profile: s.profile,
    prefs: s.prefs,
    interactions: s.interactions,
    updatedAt: now,
    lastSentAt: prev?.lastSentAt ?? null,
    sentIds: prev?.sentIds ?? [],
  };
  await setJson(keyFor(uid), next);
  if (next.active) await setAdd(INDEX, uid);
  else await setRemove(INDEX, uid);
  return next;
}

/** Baja desde el mail: apaga la alerta y la saca del índice. */
export async function disableAlert(uid: string): Promise<boolean> {
  const [a] = await getManyJson<StoredAlert>([keyFor(uid)]);
  await setRemove(INDEX, uid);
  if (!a) return false;
  if (a.active) await setJson(keyFor(uid), { ...a, active: false, updatedAt: Date.now() });
  return true;
}

export const unsubscribeToken = (email: string) => {
  const uid = userId(email);
  return `${uid}.${signValue(`alerta:${uid}`)}`;
};
/** El uid del token si la firma es válida. */
export function readUnsubscribeToken(token: string): string | null {
  const [uid, sig] = token.split(".");
  if (!uid || !sig || !/^[a-f0-9]{32}$/.test(uid)) return null;
  return verifySignedValue(`alerta:${uid}`, sig) ? uid : null;
}
/** La página con el botón de baja (link visible del mail). */
export const unsubscribeUrl = (email: string) => `${SITE_URL}/alertas/baja?t=${encodeURIComponent(unsubscribeToken(email))}`;
/** La baja en un clic de los clientes de correo (List-Unsubscribe-Post): un POST directo a la API. */
export const unsubscribeApiUrl = (email: string) => `${SITE_URL}/api/alertas/baja?t=${encodeURIComponent(unsubscribeToken(email))}`;

export const resendConfigured = () => !!process.env.RESEND_API_KEY;

/** Las mejores del ranking que superan el mínimo y todavía no se mandaron. */
export function pickAlertJobs(ranked: RankedItem[], alert: Pick<StoredAlert, "minScore" | "sentIds">): RankedItem[] {
  const sent = new Set(alert.sentIds);
  return ranked.filter((i) => !i.external && i.score >= alert.minScore && !sent.has(i.id)).slice(0, ALERT_JOBS);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** El mail: armado acá, sin IA. Los datos de cada aviso salen del inventario. */
export function buildAlertEmail(jobs: RankedItem[], minScore: number, unsubscribe: string): { subject: string; html: string; text: string } {
  const n = jobs.length;
  const subject = n === 1 ? `Maru: 1 búsqueda nueva para vos (${jobs[0].score}%)` : `Maru: ${n} búsquedas nuevas para vos esta semana`;
  const link = (id: string) => `${SITE_URL}/busquedas/${encodeURIComponent(id)}`;
  const place = (j: RankedItem) => [j.locations.slice(0, 2).join(" · "), j.workplace !== "desconocido" ? j.workplaceLabel : ""].filter(Boolean).join(" · ");
  const intro = `Estas búsquedas abiertas coinciden en ${minScore}% o más con tu perfil y lo que buscás.`;
  const rows = jobs
    .map(
      (j) => `<tr><td style="padding:14px 0;border-bottom:1px solid #eceef0">
<a href="${esc(link(j.id))}" style="color:#111;font-weight:600;font-size:16px;text-decoration:none">${esc(j.title)}</a>
<div style="color:#555;font-size:14px;margin-top:2px">${esc(j.company)}${place(j) ? ` · ${esc(place(j))}` : ""}</div>
${j.reasons[0] ? `<div style="color:#2c6b4f;font-size:13px;margin-top:6px">✓ ${esc(j.reasons[0])}</div>` : ""}
</td><td style="padding:14px 0 14px 12px;border-bottom:1px solid #eceef0;text-align:right;vertical-align:top;font-weight:700;font-size:18px;white-space:nowrap">${j.score}%</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f5f6f7;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="font-size:20px;font-weight:700;margin:0 0 8px">Tus búsquedas de la semana</p>
<p style="font-size:14px;color:#555;margin:0 0 16px">${esc(intro)}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;background:#fff;border-radius:16px;padding:0 16px">${rows}</table>
<p style="margin:20px 0"><a href="${esc(`${SITE_URL}/match`)}" style="background:#00f0a0;color:#111;font-weight:700;padding:12px 20px;border-radius:24px;text-decoration:none;display:inline-block">Ver mi match completo</a></p>
<p style="font-size:12px;color:#777;line-height:1.5">El porcentaje estima afinidad con tu perfil según los datos de cada aviso; no es una probabilidad de contratación. Revisá el aviso original antes de postularte.<br>
Recibís este mail porque activaste las alertas semanales en Maru. <a href="${esc(unsubscribe)}" style="color:#777">Dejar de recibir alertas</a>.</p>
</div></body></html>`;
  const text = [
    "Tus búsquedas de la semana",
    intro,
    "",
    ...jobs.map((j) => `• ${j.title} · ${j.company} · ${j.score}%\n  ${link(j.id)}`),
    "",
    `Ver mi match completo: ${SITE_URL}/match`,
    `Dejar de recibir alertas: ${unsubscribe}`,
  ].join("\n");
  return { subject, html, text };
}

export type Mail = { to: string; subject: string; html: string; text: string; unsubscribe: string; oneClick: string };
export type Sender = (m: Mail) => Promise<boolean>;

/** Envío con la API de Resend. Remitente: ALERTS_FROM o alertas@marucoach.com (dominio verificado en Resend). */
export const resendSender: Sender = async (m) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERTS_FROM || "Maru <alertas@marucoach.com>",
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: { "List-Unsubscribe": `<${m.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok;
};

export type RunSummary = { alertas: number; conPlan: number; conBusquedas: number; enviadas: number; fallidas: number; sinClave: boolean };

/**
 * La corrida semanal. Para cada alerta activa con plan pago: rankea con su perfil y filtros, elige las nuevas
 * sobre su mínimo y manda el mail. Sin clave de Resend no manda nada ni marca nada como enviado.
 * El resumen sólo tiene cantidades (nunca emails).
 */
export async function runAlerts(deps: {
  opportunities: Opportunity[];
  postings: Map<string, StoredPosting>;
  isPaid: (email: string) => Promise<boolean>;
  send: Sender | null;
  now?: Date;
}): Promise<RunSummary> {
  const now = deps.now ?? new Date();
  const uids = await setMembers(INDEX);
  const alerts = await getManyJson<StoredAlert>(uids.map(keyFor));
  const summary: RunSummary = { alertas: 0, conPlan: 0, conBusquedas: 0, enviadas: 0, fallidas: 0, sinClave: !deps.send };
  for (const [i, alert] of alerts.entries()) {
    if (!alert?.active) continue;
    summary.alertas++;
    try {
      if (!(await deps.isPaid(alert.email))) continue;
      summary.conPlan++;
      const ranked = rankOpportunities({ opportunities: deps.opportunities, postings: deps.postings, profile: alert.profile, prefs: alert.prefs, interactions: alert.interactions, filters: alert.filters, limit: 80, now });
      const jobs = pickAlertJobs(ranked.eligible, alert);
      if (!jobs.length) continue;
      summary.conBusquedas++;
      if (!deps.send) continue;
      const unsubscribe = unsubscribeUrl(alert.email);
      const ok = await deps.send({ to: alert.email, ...buildAlertEmail(jobs, alert.minScore, unsubscribe), unsubscribe, oneClick: unsubscribeApiUrl(alert.email) });
      if (!ok) {
        summary.fallidas++;
        continue;
      }
      summary.enviadas++;
      await setJson(keyFor(uids[i]), { ...alert, lastSentAt: now.getTime(), sentIds: [...jobs.map((j) => j.id), ...alert.sentIds].slice(0, SENT_MEMORY) });
    } catch {
      summary.fallidas++;
    }
  }
  return summary;
}
