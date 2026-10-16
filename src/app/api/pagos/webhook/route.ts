import { getAccount, upsertAccount } from "@/lib/account";
import { getSubscription, mpEnabled, validSignature } from "@/lib/mercadopago";

export const runtime = "nodejs";

/**
 * Avisos de Mercado Pago sobre suscripciones. Nunca confiamos en el cuerpo del aviso:
 * consultamos la suscripción en la API y de ahí sale el estado y el email (external_reference).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string } };
  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";
  if (!id || !type.includes("preapproval")) return new Response(null, { status: 200 });
  if (!validSignature(req.headers, id)) return new Response("firma inválida", { status: 401 });
  if (!mpEnabled()) return new Response(null, { status: 200 });

  try {
    const sub = await getSubscription(id);
    const email = sub.external_reference;
    if (!email) return new Response(null, { status: 200 });
    const prev = await getAccount(email);
    const active = sub.status === "authorized";
    // Si la dio de baja, conserva el plan hasta el final del mes pagado.
    const stillPaid = !!prev?.paidUntil && Date.parse(prev.paidUntil) > Date.now();
    await upsertAccount(email, {
      plan: active || stillPaid ? "maru" : "gratis",
      status: sub.status,
      subscriptionId: sub.id,
      paidSince: active ? (prev?.paidSince ?? new Date().toISOString()) : prev?.paidSince,
    });
    return new Response(null, { status: 200 });
  } catch (err) {
    // 500: Mercado Pago reintenta más tarde.
    console.error("[pagos/webhook]", err instanceof Error ? err.message : err);
    return new Response(null, { status: 500 });
  }
}
