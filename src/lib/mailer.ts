import nodemailer from "nodemailer";

/**
 * Envío del magic link por SMTP (sirve con Brevo, Resend, SendGrid, Gmail…):
 *   SMTP_URL   = smtps://usuario:clave@smtp-relay.brevo.com:465
 *   EMAIL_FROM = "Maru <hola@tudominio.com>"
 * Sin SMTP_URL en desarrollo, el link se imprime en la consola del servidor.
 */
export async function sendMagicLink(to: string, link: string): Promise<void> {
  const url = process.env.SMTP_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("Falta SMTP_URL: no podemos enviar emails.");
    console.info(`\n[auth] Magic link para ${to}:\n${link}\n`);
    return;
  }
  const transport = nodemailer.createTransport(url);
  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? "Maru <no-reply@maru.app>",
    to,
    subject: "Tu link para entrar a Maru",
    text: `¡Hola! Entrá a Maru con este link (vence en 15 minutos):\n\n${link}\n\nSi no lo pediste, ignorá este mail.`,
    html: emailHtml(link),
  });
}

function emailHtml(link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fbf6ef;font-family:Arial,Helvetica,sans-serif;color:#2b2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf6ef;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fffdf9;border:1px solid #eadfd3;border-radius:20px;padding:32px">
<tr><td>
<div style="display:inline-block;width:36px;height:36px;border-radius:50%;background:#c0623a;color:#fffdf9;text-align:center;line-height:36px;font-family:Georgia,serif;font-size:18px">m</div>
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:20px 0 8px">Entrá a Maru</h1>
<p style="font-size:15px;line-height:1.6;color:#75685f;margin:0 0 24px">Tocá el botón para entrar a Maru. Sin contraseña: este link es tu llave. El link vence en 15 minutos. Abrilo en el mismo navegador donde armaste tu CV.</p>
<a href="${link}" style="display:inline-block;background:#c0623a;color:#fffdf9;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:bold">Entrar a Maru</a>
<p style="font-size:12px;line-height:1.6;color:#75685f;margin:24px 0 0">Si el botón no funciona, copiá este link en tu navegador:<br><a href="${link}" style="color:#9e4d2b;word-break:break-all">${link}</a></p>
<p style="font-size:12px;color:#75685f;margin:16px 0 0">Si no pediste entrar, ignorá este mail.</p>
</td></tr></table></td></tr></table></body></html>`;
}
