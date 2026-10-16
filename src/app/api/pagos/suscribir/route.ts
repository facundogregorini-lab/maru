import { upsertAccount } from "@/lib/account";
import { sessionEmail } from "@/lib/auth";
import { dbEnabled } from "@/lib/db";
import { createSubscription, mpEnabled } from "@/lib/mercadopago";

export const runtime = "nodejs";

/** "Quiero el plan": crea la suscripción en Mercado Pago para el email de la sesión y devuelve el link de pago. */
export async function POST(req: Request) {
  const email = sessionEmail(req);
  if (!email) return Response.json({ error: "Ingresá para activar tu plan.", code: "AUTH_REQUIRED" }, { status: 401 });
  if (!mpEnabled() || !dbEnabled()) {
    // Antes de configurar la API: un link fijo de Mercado Pago, si lo hay.
    const url = process.env.NEXT_PUBLIC_CHECKOUT_URL;
    if (url) return Response.json({ url });
    return Response.json({ error: "El pago se habilita muy pronto. Mientras tanto, seguí usando Maru gratis.", code: "PAYMENTS_OFF" }, { status: 503 });
  }
  try {
    const origin = new URL(req.url).origin;
    const sub = await createSubscription(email, `${origin}/cuenta?suscripcion=ok`);
    await upsertAccount(email, { subscriptionId: sub.id, status: sub.status });
    if (!sub.init_point) throw new Error("Mercado Pago no devolvió el link de pago");
    return Response.json({ url: sub.init_point });
  } catch (err) {
    console.error("[pagos/suscribir]", err instanceof Error ? err.message : err);
    return Response.json({ error: "No pudimos abrir Mercado Pago. Probá de nuevo en un rato.", code: "PAYMENT_FAILED" }, { status: 502 });
  }
}
