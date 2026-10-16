import nodemailer from "nodemailer";

/**
 * Emails de Maru por SMTP (sirve con Brevo, Resend, SendGrid, Gmail…):
 *   SMTP_URL   = smtps://usuario:clave@smtp-relay.brevo.com:465
 *   EMAIL_FROM = "Maru <hola@tudominio.com>"
 * Sin SMTP_URL en desarrollo, el contenido se imprime en la consola del servidor.
 */

type Mail = { to: string; subject: string; text: string; html: string };

async function send(mail: Mail): Promise<void> {
  const url = process.env.SMTP_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta SMTP_URL: no podemos enviar emails.");
    console.info(`\n[mail] Para ${mail.to} · ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await nodemailer.createTransport(url).sendMail({ from: process.env.EMAIL_FROM ?? "Maru Coach <no-reply@maru.app>", ...mail });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** El marco de todos los emails, con la marca actual (negro, blanco y neón). */
function layout(title: string, body: string, footer = ""): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f6f7;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:24px;padding:32px">
<tr><td>
<div style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#00f0a0;color:#111;text-align:center;line-height:36px;font-weight:bold;font-size:18px">m</div>
<h1 style="font-size:24px;margin:20px 0 8px">${title}</h1>
${body}
${footer ? `<p style="font-size:12px;line-height:1.6;color:#6b7280;margin:24px 0 0">${footer}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:bold">${label}</a>`;

export async function sendMagicLink(to: string, link: string): Promise<void> {
  await send({
    to,
    subject: "Tu link para entrar a Maru Coach",
    text: `¡Hola! Entrá a Maru Coach con este link (vence en 15 minutos):\n\n${link}\n\nSi no lo pediste, ignorá este mail.`,
    html: layout(
      "Entrá a Maru Coach",
      `<p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px">Tocá el botón para entrar. Sin contraseña: este link es tu llave y vence en 15 minutos. Abrilo en el mismo navegador donde estabas usando Maru.</p>
${button(link, "Entrar a Maru Coach")}
<p style="font-size:12px;line-height:1.6;color:#6b7280;margin:24px 0 0">Si el botón no funciona, copiá este link:<br><a href="${link}" style="color:#111;word-break:break-all">${link}</a></p>`,
      "Si no pediste entrar, ignorá este mail.",
    ),
  });
}

export type AlertJob = { title: string; company: string; where: string; url: string };
export type AlertBlock = { title: string; url: string; jobs: AlertJob[] };

/** Resumen diario de búsquedas nuevas, agrupadas por alerta. */
export async function sendAlertDigest(to: string, blocks: AlertBlock[], unsubscribeUrl: string): Promise<void> {
  const total = blocks.reduce((n, b) => n + b.jobs.length, 0);
  const subject = total === 1 ? "1 búsqueda nueva para vos" : `${total} búsquedas nuevas para vos`;
  const text = blocks
    .map((b) => `${b.title}\n${b.jobs.map((j) => `- ${j.title} · ${j.company}${j.where ? ` · ${j.where}` : ""}\n  ${j.url}`).join("\n")}\nVer todas: ${b.url}`)
    .join("\n\n");
  const html = blocks
    .map(
      (b) => `<h2 style="font-size:15px;margin:24px 0 8px">${esc(b.title)}</h2>
${b.jobs
  .map(
    (j) => `<a href="${j.url}" style="display:block;text-decoration:none;color:#111;background:#f5f6f7;border-radius:14px;padding:12px 14px;margin:0 0 8px">
<strong style="font-size:15px">${esc(j.title)}</strong><br><span style="font-size:13px;color:#4b5563">${esc(j.company)}${j.where ? ` · ${esc(j.where)}` : ""}</span></a>`,
  )
  .join("")}
<p style="margin:8px 0 0"><a href="${b.url}" style="font-size:13px;color:#111">Ver todas →</a></p>`,
    )
    .join("");
  await send({
    to,
    subject,
    text: `${text}\n\nPara no recibir más alertas: ${unsubscribeUrl}`,
    html: layout(subject, `<p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0">Encontramos búsquedas abiertas nuevas que coinciden con tus alertas.</p>${html}`, `¿No querés recibir más estos emails? <a href="${unsubscribeUrl}" style="color:#111">Dejar de recibir alertas</a>.`),
  });
}
