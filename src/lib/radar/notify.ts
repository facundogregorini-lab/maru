import { signValue, verifySignedValue } from "../auth";
import { SITE_URL } from "../site";
import { radarRepos } from "./repo";
import { digestDue } from "./schedule";
import { detectedOpportunities, listTargets, readSettings, type DetectedJob } from "./service";
import type { OutboxDoc, OutboxItem, RadarNotification, RadarSettings } from "./types";

/**
 * Entrega de Radar: primero in-app; email sólo si la persona lo aceptó en Automatización (Resend, como las
 * alertas de Match). Nada de WhatsApp. Cada envío tiene una clave idempotente por (persona, vacante, evento) o
 * (persona, resumen, semana): reintentar el cron no duplica nada. Pausar cancela lo pendiente.
 */

export type Mail = { to: string; subject: string; html: string; text: string; unsubscribe: string };
export type Sender = (m: Mail) => Promise<boolean>;

const MAX_NOTIFICATIONS = 100;
const MAX_ATTEMPTS = 3;

export const alertKey = (uid: string, jobId: string) => `${uid}|${jobId}|alert`;
export const digestKey = (uid: string, week: string) => `${uid}|digest|${week}`;

/** Alerta inmediata: empresa P1, match ≥ umbral, elegible, que encaja, al día y no descartada. */
export function alertCandidates(jobs: DetectedJob[], settings: RadarSettings): DetectedJob[] {
  if (!settings.enabled || !settings.instantAlerts.enabled) return [];
  return jobs.filter((j) => {
    const m = j.match;
    return j.priority === "P1" && !!m && m.score !== null && m.score >= settings.instantAlerts.threshold && m.eligibility === "eligible" && !m.rejected && !m.stale && m.disposition !== "dismissed";
  });
}

export type DigestContent = { top: (DetectedJob & { alreadyAlerted: boolean })[]; newCount: number; closedCount: number; sourceErrors: number; coverage: { checked: number; total: number } };

export function buildDigest(jobs: DetectedJob[], alerted: Set<string>, ctx: { since: string | null; closedSince: number; sourceErrors: number; coverage: { checked: number; total: number } }): DigestContent {
  const ranked = jobs.filter((j) => j.action && j.match?.disposition !== "dismissed").slice(0, 5);
  const isNew = (j: DetectedJob) => !ctx.since || j.firstSeenAt > ctx.since;
  return {
    top: ranked.map((j) => ({ ...j, alreadyAlerted: alerted.has(j.id) })),
    // Lo que ya llegó como alerta no se cuenta de nuevo como nuevo.
    newCount: jobs.filter((j) => isNew(j) && !alerted.has(j.id) && j.match?.disposition !== "dismissed").length,
    closedCount: ctx.closedSince,
    sourceErrors: ctx.sourceErrors,
    coverage: ctx.coverage,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function unsubscribeToken(uid: string): string {
  return `${uid}.${signValue(`radar-baja:${uid}`)}`;
}
export function readUnsubscribeToken(t: string | null): string | null {
  const [uid, sig] = (t ?? "").split(".");
  return uid && sig && /^[a-f0-9]{32}$/.test(uid) && verifySignedValue(`radar-baja:${uid}`, sig) ? uid : null;
}

export function digestText(d: DigestContent): { title: string; body: string } {
  const lines = d.top.map((j) => `• ${j.companyName} · ${j.title} · ${j.match?.score}/100${j.alreadyAlerted ? " (ya te avisamos)" : ""}`);
  const summary = `${d.newCount} nuevas · ${d.closedCount} cerradas · ${d.coverage.checked}/${d.coverage.total} empresas revisadas${d.sourceErrors ? ` · ${d.sourceErrors} fuentes con error` : ""}`;
  return { title: "Tu resumen semanal de Radar", body: [summary, ...(lines.length ? lines : ["Esta semana no hubo vacantes para recomendarte."])].join("\n") };
}

export function digestEmail(d: DigestContent, unsubscribe: string): { subject: string; html: string; text: string } {
  const { title, body } = digestText(d);
  const link = `${SITE_URL}/radar/oportunidades`;
  const items = d.top
    .map((j) => `<li style="margin:0 0 8px"><b>${esc(j.companyName)}</b> · ${esc(j.title)} · ${j.match?.score}/100${j.alreadyAlerted ? " <i>(ya te avisamos)</i>" : ""}<br><span style="color:#5c6066">${esc(j.match?.mainReason ?? "")}</span></li>`)
    .join("");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#000"><h1 style="font-size:20px">${esc(title)}</h1><p>${esc(body.split("\n")[0])}</p><ul style="padding-left:18px">${items}</ul><p><a href="${link}">Ver todas en Radar</a></p><p style="color:#5c6066;font-size:12px">El match es una guía, no una probabilidad de contratación. <a href="${unsubscribe}">No recibir más por email</a></p></body></html>`;
  return { subject: title, html, text: `${body}\n\nVer todas: ${link}\nNo recibir más por email: ${unsubscribe}` };
}

export function alertEmail(j: DetectedJob, unsubscribe: string): { subject: string; html: string; text: string } {
  const subject = `Radar: ${j.companyName} publicó ${j.title}`;
  const link = `${SITE_URL}/radar/oportunidades`;
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif"><p><b>${esc(j.companyName)}</b> publicó <b>${esc(j.title)}</b> (${j.match?.score}/100).</p><p>${esc(j.match?.mainReason ?? "")}</p><p><a href="${link}">Verla en Radar</a></p><p style="color:#5c6066;font-size:12px"><a href="${unsubscribe}">No recibir más por email</a></p></body></html>`;
  return { subject, html, text: `${j.companyName} publicó ${j.title} (${j.match?.score}/100).\n${j.match?.mainReason ?? ""}\n${link}\nNo recibir más por email: ${unsubscribe}` };
}

export type DeliverResult = { alerts: number; digest: boolean; emailsSent: number; emailsFailed: number; cancelled: number };

/** Entrega de una persona. Idempotente: se puede correr las veces que haga falta. */
export async function deliver(uid: string, opts: { now?: Date; send?: Sender | null } = {}): Promise<DeliverResult> {
  const now = opts.now ?? new Date();
  const iso = now.toISOString();
  const repos = radarRepos();
  const settings = await readSettings(uid);
  const outbox: OutboxDoc = await repos.user.outbox(uid);
  const res: DeliverResult = { alerts: 0, digest: false, emailsSent: 0, emailsFailed: 0, cancelled: 0 };

  // Pausa: cancela lo que no salió.
  if (!settings.enabled) {
    for (const it of Object.values(outbox.items)) if (it.status === "pending") { it.status = "cancelled"; res.cancelled++; }
    if (res.cancelled) await repos.user.saveOutbox(uid, { ...outbox, updatedAt: now.getTime() });
    return res;
  }

  const notes = await repos.user.notifications(uid);
  const email = settings.channels.email ? await repos.user.contact(uid) : null;
  const opps = await detectedOpportunities(uid);
  const add = (kind: OutboxItem["kind"], key: string, jobIds: string[], note: Pick<RadarNotification, "title" | "body">) => {
    outbox.items[`${key}|in_app`] = { key: `${key}|in_app`, kind, channel: "in_app", status: "sent", attempts: 1, jobIds, createdAt: iso, sentAt: iso };
    notes.items = [{ id: `${kind}_${now.getTime().toString(36)}_${notes.items.length}`, kind, at: iso, read: false, ...note, jobIds }, ...notes.items].slice(0, MAX_NOTIFICATIONS);
    if (email) outbox.items[`${key}|email`] = { key: `${key}|email`, kind, channel: "email", status: "pending", attempts: 0, jobIds, createdAt: iso, sentAt: null };
  };

  for (const j of alertCandidates(opps.jobs, settings)) {
    const key = alertKey(uid, j.id);
    if (outbox.items[`${key}|in_app`]) continue;
    add("alert", key, [j.id], { title: `${j.companyName} publicó ${j.title}`, body: `${j.match?.score}/100 · ${j.match?.mainReason ?? ""}`.trim() });
    res.alerts++;
  }

  const { due, week } = digestDue(settings, now);
  const dkey = digestKey(uid, week);
  if (due && !outbox.items[`${dkey}|in_app`]) {
    const lastDigest = Object.values(outbox.items).filter((i) => i.kind === "digest" && i.channel === "in_app").map((i) => i.createdAt).sort().pop() ?? null;
    const alerted = new Set(Object.values(outbox.items).filter((i) => i.kind === "alert").flatMap((i) => i.jobIds));
    const summary = (await listTargets(uid)).summary;
    const d = buildDigest(opps.jobs, alerted, {
      since: lastDigest,
      closedSince: opps.recentlyClosed.filter((c) => !lastDigest || (c.closedAt ?? "") > lastDigest).length,
      sourceErrors: summary.sourcesWithError,
      coverage: { checked: opps.companies.checked, total: opps.companies.total },
    });
    const t = digestText(d);
    add("digest", dkey, d.top.map((j) => j.id), t);
    res.digest = true;
  }

  // Emails pendientes (los nuevos y los que fallaron antes), con tope de intentos.
  if (opts.send && email) {
    const unsubscribe = `${SITE_URL}/api/radar/baja?t=${encodeURIComponent(unsubscribeToken(uid))}`;
    const byId = new Map(opps.jobs.map((j) => [j.id, j]));
    for (const it of Object.values(outbox.items)) {
      if (it.channel !== "email" || it.status !== "pending") continue;
      let mail: { subject: string; html: string; text: string } | null = null;
      if (it.kind === "alert") {
        const j = byId.get(it.jobIds[0]);
        mail = j ? alertEmail(j, unsubscribe) : null;
      } else {
        const alerted = new Set(Object.values(outbox.items).filter((i) => i.kind === "alert").flatMap((i) => i.jobIds));
        const jobs = it.jobIds.map((id) => byId.get(id)).filter((j): j is DetectedJob => !!j);
        mail = digestEmail(buildDigest(jobs, alerted, { since: it.createdAt, closedSince: 0, sourceErrors: 0, coverage: { checked: opps.companies.checked, total: opps.companies.total } }), unsubscribe);
      }
      if (!mail) { it.status = "cancelled"; continue; }
      it.attempts++;
      let ok = false;
      try {
        ok = await opts.send({ to: email, ...mail, unsubscribe });
      } catch {
        ok = false;
      }
      if (ok) { it.status = "sent"; it.sentAt = iso; res.emailsSent++; }
      else if (it.attempts >= MAX_ATTEMPTS) { it.status = "failed"; res.emailsFailed++; }
      else res.emailsFailed++;
    }
  }

  await repos.user.saveOutbox(uid, { ...outbox, updatedAt: now.getTime() });
  await repos.user.saveNotifications(uid, { ...notes, updatedAt: now.getTime() });
  return res;
}

/** Envío por Resend (la misma integración de las alertas de Match). */
export const resendRadarSender: Sender = async (m) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RADAR_FROM || process.env.ALERTS_FROM || "Maru <alertas@marucoach.com>",
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: { "List-Unsubscribe": `<${m.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
};
