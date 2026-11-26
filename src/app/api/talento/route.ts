import { billingJson, billingSession, loginRequired } from "@/lib/billing/http";
import { dbConfigured } from "@/lib/db";
import { TalentoPrefsSchema, TalentoPutSchema, normalizeProfile, readTalento, removeTalento, saveTalento } from "@/lib/recruiters/talento";

export const runtime = "nodejs";

/**
 * «Abierto a propuestas»: la persona que busca trabajo deja que empresas que usan Maru Recruiters encuentren su experiencia.
 * GET: si está activo. PUT { activo: true, profile, prefs } lo activa o actualiza; { activo: false } lo apaga y borra el registro.
 */
export async function GET(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!dbConfigured()) return billingJson({ disponible: false, activo: false });
  try {
    const t = await readTalento(email);
    return billingJson({ disponible: true, activo: !!t, actualizadoEn: t?.actualizadoEn ?? null });
  } catch {
    return billingJson({ error: "No pudimos leer tu configuración. Probá en un momento.", code: "DB_UNAVAILABLE" }, 503);
  }
}

export async function PUT(req: Request) {
  const email = billingSession(req);
  if (!email) return loginRequired();
  if (!dbConfigured()) return billingJson({ error: "Esta opción todavía no está disponible.", code: "DB_NOT_CONFIGURED" }, 503);
  const raw = await req.text();
  if (raw.length > 300_000) return billingJson({ error: "El pedido es demasiado grande.", code: "TOO_LARGE" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return billingJson({ error: "Pedido inválido.", code: "BAD_REQUEST" }, 400);
  }
  const parsed = TalentoPutSchema.safeParse(body);
  if (!parsed.success) return billingJson({ error: "Pedido inválido.", code: "BAD_REQUEST" }, 400);
  try {
    if (!parsed.data.activo) {
      await removeTalento(email);
      return billingJson({ disponible: true, activo: false, actualizadoEn: null });
    }
    const profile = normalizeProfile(parsed.data.profile);
    if (!profile) return billingJson({ error: "Cargá tu CV en Maru antes de activar esta opción.", code: "PROFILE_MISSING" }, 422);
    const t = await saveTalento(email, profile, parsed.data.prefs ?? TalentoPrefsSchema.parse({}));
    return billingJson({ disponible: true, activo: true, actualizadoEn: t.actualizadoEn });
  } catch {
    return billingJson({ error: "No pudimos guardar tu configuración. Probá en un momento.", code: "DB_UNAVAILABLE" }, 503);
  }
}
