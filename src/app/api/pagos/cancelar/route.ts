import { getAccount, nextRenewal, upsertAccount } from "@/lib/account";
import { sessionEmail } from "@/lib/auth";
import { setJson } from "@/lib/db";
import { cancelSubscription, mpEnabled } from "@/lib/mercadopago";

export const runtime = "nodejs";

const REGRET_DAYS = 10;

/**
 * Dar de baja el plan. Con `arrepentimiento: true` (botón de arrepentimiento, Ley 24.240 y Res. 424/2020),
 * además queda registrado el pedido de reintegro si está dentro de los 10 días de la contratación.
 */
export async function POST(req: Request) {
  const email = sessionEmail(req);
  if (!email) return Response.json({ error: "Ingresá con el email de tu plan.", code: "AUTH_REQUIRED" }, { status: 401 });
  const { arrepentimiento = false } = (await req.json().catch(() => ({}))) as { arrepentimiento?: boolean };
  const account = await getAccount(email);
  if (!account?.subscriptionId) return Response.json({ error: "No encontramos un plan activo para este email.", code: "NO_PLAN" }, { status: 404 });

  try {
    if (mpEnabled()) await cancelSubscription(account.subscriptionId);
    // Baja normal: sigue con el plan hasta el final del mes pagado. Arrepentimiento: se corta ya (y se devuelve lo pagado).
    if (arrepentimiento) await upsertAccount(email, { plan: "gratis", status: "cancelled", paidUntil: undefined });
    else await upsertAccount(email, { status: "cancelled", paidUntil: account.paidSince ? nextRenewal(account.paidSince) : undefined, plan: account.paidSince ? "maru" : "gratis" });
    let reintegro = false;
    if (arrepentimiento && account.paidSince) {
      reintegro = Date.now() - new Date(account.paidSince).getTime() <= REGRET_DAYS * 86_400_000;
      await setJson(`arrepentimiento:${email}`, { email, pedidoEl: new Date().toISOString(), paidSince: account.paidSince, subscriptionId: account.subscriptionId, reintegro });
      console.warn(`[pagos] botón de arrepentimiento: ${email} (reintegro: ${reintegro ? "sí" : "fuera de plazo"})`);
    }
    return Response.json({ ok: true, reintegro });
  } catch (err) {
    console.error("[pagos/cancelar]", err instanceof Error ? err.message : err);
    return Response.json({ error: "No pudimos dar de baja el plan. Probá de nuevo en un rato.", code: "CANCEL_FAILED" }, { status: 502 });
  }
}
