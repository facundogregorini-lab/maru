import { signValue, verifySignedValue } from "../auth";
import { getManyJson, incrementWithTtl, keyExists, setAdd, setJson, setMembers, setRemove, deleteKeys } from "../db";
import { SITE_URL } from "../site";
import { userId } from "../sync/server";
import type { Candidato, Canal, Envio, Inscripcion, Secuencia } from "./types";

/**
 * Outreach de Maru Recruiters: una secuencia por búsqueda (pasos por email, WhatsApp o LinkedIn con días de espera)
 * y una inscripción por candidato. El email sale por Resend desde el dominio de Maru con Reply-To del reclutador;
 * WhatsApp sale solo si está configurada la API de WhatsApp Business (si no, queda como tarea con el mensaje listo),
 * y LinkedIn es siempre una tarea manual (no se automatiza LinkedIn).
 */

export { CANALES, ESTADOS_INSCRIPCION, PasoSchema, SecuenciaEditSchema } from "./types";
export type { Canal, Envio, EstadoInscripcion, Inscripcion, Paso, Secuencia, SecuenciaEdit } from "./types";

const sKey = (b: string) => `maru:rec:s:${b}`;
const iKey = (b: string, c: string) => `maru:rec:i:${b}:${c}`;
const iSet = (b: string) => `maru:rec:s:${b}:i`;
const DUE = "maru:rec:enviar";
const bajaKey = (email: string) => `maru:rec:baja:${userId(email)}`;

export async function readSecuencia(b: string): Promise<Secuencia | null> {
  return (await getManyJson<Secuencia>([sKey(b)]))[0];
}
export async function saveSecuencia(b: string, s: Secuencia): Promise<void> {
  await setJson(sKey(b), s);
}
export async function readInscripciones(b: string): Promise<Inscripcion[]> {
  const ids = await setMembers(iSet(b));
  return (await getManyJson<Inscripcion>(ids.map((c) => iKey(b, c)))).filter((x): x is Inscripcion => !!x);
}
export async function readInscripcion(b: string, c: string): Promise<Inscripcion | null> {
  return (await getManyJson<Inscripcion>([iKey(b, c)]))[0];
}
export async function saveInscripcion(i: Inscripcion): Promise<void> {
  await setJson(iKey(i.busquedaId, i.candidatoId), i);
  await setAdd(iSet(i.busquedaId), i.candidatoId);
  const member = `${i.busquedaId}:${i.candidatoId}`;
  if (i.estado === "activa") await setAdd(DUE, member);
  else await setRemove(DUE, member);
}
export async function deleteOutreach(b: string): Promise<void> {
  const ids = await setMembers(iSet(b));
  for (const c of ids) await setRemove(DUE, `${b}:${c}`);
  await deleteKeys([sKey(b), iSet(b), ...ids.map((c) => iKey(b, c))]);
}
export const dueMembers = () => setMembers(DUE);

/* ---------- Bajas globales: la persona no quiere más mensajes de empresas por Maru ---------- */

export const isSuppressed = (email: string) => keyExists(bajaKey(email));
export async function suppress(email: string): Promise<void> {
  await setJson(bajaKey(email), { en: Date.now() });
}

/* ---------- Tope diario de envíos automáticos por cuenta (cuida la reputación del dominio) ---------- */

export const dailyEmailLimit = () => {
  const n = Number(process.env.RECRUITERS_DAILY_EMAILS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
};
const dayAr = (now: number) => new Date(now - 3 * 3600_000).toISOString().slice(0, 10);
export async function takeEmail(owner: string, now = Date.now()): Promise<boolean> {
  const key = `maru:rec:mail:${owner}:${dayAr(now)}`;
  const used = await incrementWithTtl(key, 1, 2 * 86400);
  if (used > dailyEmailLimit()) {
    await incrementWithTtl(key, -1, 2 * 86400);
    return false;
  }
  return true;
}

/* ---------- Textos ---------- */

export type Vars = { nombre: string; puesto: string; empresa: string; remitente: string; gancho: string };

/** Reemplaza {{nombre}}, {{puesto}}, {{empresa}}, {{remitente}} y {{gancho}}. Lo demás queda tal cual. */
export function render(text: string, v: Vars): string {
  return text
    .replace(/\{\{\s*(nombre|puesto|empresa|remitente|gancho)\s*\}\}/g, (_, k: keyof Vars) => v[k] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const firstName = (nombre: string) => nombre.replace(/\s+/g, " ").trim().split(" ")[0] || "";

/** Asunto del hilo: el del primer email de la secuencia; los siguientes, "Re: …". */
export function subjectFor(s: Secuencia, paso: number, v: Vars): string {
  const firstEmail = s.pasos.findIndex((p) => p.canal === "email");
  const base = render(s.pasos[firstEmail]?.asunto || `Búsqueda de ${v.puesto} en ${v.empresa}`, v);
  return paso === firstEmail ? base : `Re: ${base}`;
}

/* ---------- Links firmados: «Me interesa», «No, gracias» y la baja ---------- */

export const responseToken = (b: string, c: string) => `${b}.${c}.${signValue(`rec:${b}:${c}`)}`;
export function readResponseToken(t: string): { busquedaId: string; candidatoId: string } | null {
  const [b, c, sig] = t.split(".");
  if (!b || !c || !sig) return null;
  return verifySignedValue(`rec:${b}:${c}`, sig) ? { busquedaId: b, candidatoId: c } : null;
}
export const responseUrl = (b: string, c: string, r: "si" | "no" | "baja") => `${SITE_URL}/recruiters/respuesta?t=${encodeURIComponent(responseToken(b, c))}&r=${r}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function buildOutreachEmail(o: { body: string; empresa: string; remitente: string; busquedaId: string; candidatoId: string }): { html: string; text: string } {
  const si = responseUrl(o.busquedaId, o.candidatoId, "si");
  const no = responseUrl(o.busquedaId, o.candidatoId, "no");
  const baja = responseUrl(o.busquedaId, o.candidatoId, "baja");
  const pie = `${o.remitente} (${o.empresa}) te escribe por Maru Recruiters. Si respondés este mail, le llega a ${o.remitente} y ve tu email.`;
  const paragraphs = o.body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:15px">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">${paragraphs}
<p style="margin:20px 0 8px"><a href="${esc(si)}" style="background:#00f0a0;color:#111;font-weight:700;padding:11px 18px;border-radius:24px;text-decoration:none;display:inline-block">Me interesa</a>
&nbsp;<a href="${esc(no)}" style="color:#111;padding:11px 12px;display:inline-block">No, gracias</a></p>
<p style="font-size:12px;color:#777;line-height:1.5;margin-top:24px">${esc(pie)} Cómo usamos tus datos: <a href="${esc(`${SITE_URL}/privacidad`)}" style="color:#777">${esc(`${SITE_URL.replace(/^https?:\/\//, "")}/privacidad`)}</a>. <a href="${esc(baja)}" style="color:#777">No quiero recibir mensajes de empresas por Maru</a>.</p>
</div></body></html>`;
  const text = [o.body, "", `Me interesa: ${si}`, `No, gracias: ${no}`, "", pie, `Privacidad: ${SITE_URL}/privacidad`, `No quiero recibir mensajes de empresas por Maru: ${baja}`].join("\n");
  return { html, text };
}

/* ---------- Envío ---------- */

export const outreachFrom = (remitente: string) => {
  const base = process.env.RECRUITERS_FROM || "recruiters@marucoach.com";
  const address = base.match(/<([^>]+)>/)?.[1] ?? base;
  const name = `${remitente.replace(/["<>]/g, "").slice(0, 60)} vía Maru`;
  return `${name} <${address}>`;
};

export type OutMail = { to: string; from: string; replyTo: string; subject: string; html: string; text: string; unsubscribe: string };
export type OutSender = (m: OutMail) => Promise<boolean>;

export const outreachEmailConfigured = () => !!process.env.RESEND_API_KEY;

export const resendOutreach: OutSender = async (m) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: m.from, to: [m.to], reply_to: m.replyTo, subject: m.subject, html: m.html, text: m.text, headers: { "List-Unsubscribe": `<${m.unsubscribe}>` } }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  return !!res?.ok;
};

/**
 * WhatsApp Business (API de Meta). Los mensajes que inicia una empresa tienen que usar una plantilla aprobada:
 * WHATSAPP_TEMPLATE con tres variables en el cuerpo ({{1}} nombre, {{2}} remitente y empresa, {{3}} el mensaje del paso).
 * Sin WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_TEMPLATE, el paso queda como tarea para el reclutador.
 */
export const whatsappConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE);

/** Teléfono en formato internacional sin "+" (lo que piden wa.me y la API). Asume Argentina si no tiene código de país. */
export function waNumber(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else {
    d = d.replace(/^0/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
    d = `549${d}`;
  }
  if (d.startsWith("54") && !d.startsWith("549") && d.length === 12) d = `549${d.slice(2)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}
export const waLink = (phone: string, text: string) => {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};

export async function sendWhatsappTemplate(to: string, params: [string, string, string]): Promise<boolean> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: process.env.WHATSAPP_TEMPLATE, language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es_AR" }, components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text.slice(0, 900) })) }] },
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  return !!res?.ok;
}

/* ---------- Paso a paso ---------- */

/** Próximo día hábil a las 10:00 de Argentina, `dias` después de `from`. */
export function scheduleAfter(from: number, dias: number): number {
  if (dias <= 0) return from;
  const d = new Date(from - 3 * 3600_000);
  d.setUTCDate(d.getUTCDate() + dias);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(10, 0, 0, 0);
  return d.getTime() + 3 * 3600_000;
}

export type Destino = { email: string; telefono: string; linkedin: string };

/**
 * Ejecuta el paso que toca. Email (y WhatsApp con API) se envían; si no se puede, o es LinkedIn, queda como tarea.
 * Devuelve la inscripción actualizada (no la guarda).
 */
export async function runStep(o: {
  insc: Inscripcion;
  sec: Secuencia;
  candidato: Candidato;
  destino: Destino;
  puesto: string;
  replyTo: string;
  owner: string;
  now?: number;
  send?: OutSender;
}): Promise<Inscripcion> {
  const now = o.now ?? Date.now();
  const { insc, sec } = o;
  const paso = sec.pasos[insc.paso];
  if (!paso) return { ...insc, estado: "completada", actualizadaEn: now };
  const v: Vars = { nombre: firstName(o.candidato.nombre), puesto: o.puesto, empresa: sec.empresa, remitente: sec.remitente, gancho: insc.gancho };
  const body = render(paso.cuerpo, v);
  const advance = (envio: Envio): Inscripcion => {
    const next = insc.paso + 1;
    const done = next >= sec.pasos.length;
    return { ...insc, historial: [...insc.historial, envio], paso: next, estado: done ? "completada" : "activa", proximoEn: done ? 0 : scheduleAfter(now, sec.pasos[next].dias), actualizadaEn: now };
  };
  const tarea = (error?: string): Inscripcion => ({ ...insc, estado: "tarea", actualizadaEn: now, historial: error ? [...insc.historial, { paso: insc.paso, canal: paso.canal, en: now, ok: false, error }] : insc.historial });

  if (paso.canal === "email") {
    if (!o.destino.email) return advance({ paso: insc.paso, canal: "email", en: now, ok: false, error: "Sin email" });
    if (await isSuppressed(o.destino.email)) return { ...insc, estado: "baja", actualizadaEn: now };
    if (!outreachEmailConfigured()) return tarea("El envío de mails no está configurado");
    if (!(await takeEmail(o.owner, now))) return insc; // tope del día: queda para mañana
    const { html, text } = buildOutreachEmail({ body, empresa: sec.empresa, remitente: sec.remitente, busquedaId: insc.busquedaId, candidatoId: insc.candidatoId });
    const ok = await (o.send ?? resendOutreach)({ to: o.destino.email, from: outreachFrom(sec.remitente), replyTo: o.replyTo, subject: subjectFor(sec, insc.paso, v), html, text, unsubscribe: responseUrl(insc.busquedaId, insc.candidatoId, "baja") });
    return ok ? advance({ paso: insc.paso, canal: "email", en: now, ok: true }) : tarea("No se pudo enviar el mail");
  }
  if (paso.canal === "whatsapp") {
    const to = waNumber(o.destino.telefono);
    if (!to) return advance({ paso: insc.paso, canal: "whatsapp", en: now, ok: false, error: "Sin teléfono" });
    if (whatsappConfigured() && (await sendWhatsappTemplate(to, [v.nombre || "Hola", `${sec.remitente} de ${sec.empresa}`, body]))) return advance({ paso: insc.paso, canal: "whatsapp", en: now, ok: true });
    return tarea();
  }
  // LinkedIn: siempre manual, con el mensaje listo para copiar. Sin perfil de LinkedIn, se saltea.
  if (!o.destino.linkedin) return advance({ paso: insc.paso, canal: "linkedin", en: now, ok: false, error: "Sin LinkedIn" });
  return tarea();
}

/** El reclutador hizo la tarea manual (WhatsApp o LinkedIn): se registra y se programa el paso siguiente. */
export function completeTask(insc: Inscripcion, sec: Secuencia, now = Date.now()): Inscripcion {
  const paso = sec.pasos[insc.paso];
  const next = insc.paso + 1;
  const done = next >= sec.pasos.length;
  return {
    ...insc,
    historial: [...insc.historial, { paso: insc.paso, canal: paso?.canal ?? "linkedin", en: now, ok: true, manual: true }],
    paso: next,
    estado: done ? "completada" : "activa",
    proximoEn: done ? 0 : scheduleAfter(now, sec.pasos[next].dias),
    actualizadaEn: now,
  };
}

/** Texto del paso para una tarea manual (copiar en LinkedIn o abrir en WhatsApp). */
export function taskText(insc: Inscripcion, sec: Secuencia, c: Pick<Candidato, "nombre">, puesto: string): string {
  const paso = sec.pasos[insc.paso];
  return paso ? render(paso.cuerpo, { nombre: firstName(c.nombre), puesto, empresa: sec.empresa, remitente: sec.remitente, gancho: insc.gancho }) : "";
}

/** Aviso al reclutador (por ejemplo, «Me interesa»). Sin RESEND_API_KEY no manda nada. */
export async function notifyRecruiter(to: string, subject: string, text: string): Promise<boolean> {
  if (!outreachEmailConfigured() || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: outreachFrom("Maru Recruiters").replace(" vía Maru", ""), to: [to], subject, text }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  return !!res?.ok;
}
