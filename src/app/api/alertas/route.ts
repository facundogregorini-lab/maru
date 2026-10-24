import { alertView, AlertSettingsSchema, readAlert, resendConfigured, saveAlert } from "@/lib/alerts";
import { billingJson, billingSession, loginRequired, paidFeatures } from "@/lib/billing/http";
import { dbConfigured } from "@/lib/db";

export const runtime = "nodejs";

/** Alerta semanal de la cuenta. GET: cómo está. PUT: la guarda (activarla es del plan pago; apagarla, de todos). */
export async function GET(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!dbConfigured()) return billingJson({ disponible: false, envio: false, pro: false, alerta: null });
  try {
    const [alert, pro] = await Promise.all([readAlert(email), paidFeatures(req)]);
    return billingJson({ disponible: true, envio: resendConfigured(), pro, alerta: alertView(alert) });
  } catch {
    return billingJson({ error: "No pudimos leer tu alerta. Probá en un momento.", code: "DB_UNAVAILABLE" }, 503);
  }
}

export async function PUT(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!dbConfigured()) return billingJson({ error: "Las alertas todavía no están disponibles.", code: "DB_NOT_CONFIGURED" }, 503);
  const raw = await req.text();
  if (raw.length > 200_000) return billingJson({ error: "El pedido es demasiado grande.", code: "TOO_LARGE" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return billingJson({ error: "Pedido inválido.", code: "BAD_REQUEST" }, 400);
  }
  const parsed = AlertSettingsSchema.safeParse(body);
  if (!parsed.success) return billingJson({ error: "Revisá la alerta: hay datos inválidos.", code: "BAD_REQUEST" }, 400);
  try {
    if (parsed.data.active && !(await paidFeatures(req)))
      return billingJson({ error: "Las alertas semanales son del plan de Maru.", code: "PLAN_FEATURE", upgradeUrl: "/precios" }, 402);
    const alert = await saveAlert(email, parsed.data);
    return billingJson({ disponible: true, envio: resendConfigured(), pro: true, alerta: alertView(alert) });
  } catch {
    return billingJson({ error: "No pudimos guardar tu alerta. Probá en un momento.", code: "DB_UNAVAILABLE" }, 503);
  }
}
