import { checkCreation, recordCreation, type Who } from "./account";
import { sessionEmail } from "./auth";
import { mpEnabled } from "./mercadopago";
import { clientIp } from "./rateLimit";

/** Se puede cobrar (API de Mercado Pago o, mientras tanto, un link fijo). Sin cobro no hay límites: no se le pide pagar a nadie si no puede. */
export const paymentsEnabled = () => mpEnabled() || !!process.env.NEXT_PUBLIC_CHECKOUT_URL;

/**
 * Control del plan gratis en las rutas que crean algo (CV a medida, CV, carta, entrevista, video).
 * Si no le quedan creaciones, responde 402 con code PLAN_REQUIRED (la web abre la oferta de Maru).
 * Si la base falla, deja pasar: un problema nuestro no le corta el trabajo a nadie.
 */
export async function creationGate(req: Request): Promise<Response | { done: () => Promise<void> }> {
  if (!paymentsEnabled()) return { done: async () => {} };
  let email: string | null = null;
  try {
    email = sessionEmail(req);
  } catch {
    // sin AUTH_SECRET o cookie rota: cuenta por IP
  }
  const who: Who = { email, ip: clientIp(req.headers) };
  const quota = await checkCreation(who).catch((err) => {
    console.error("[plan]", err instanceof Error ? err.message : err);
    return null;
  });
  if (quota && !quota.allowed) {
    return Response.json(
      {
        error: `Usaste tus ${quota.limit} creaciones gratis de este mes. Con el plan Maru son ilimitadas.`,
        code: "PLAN_REQUIRED",
      },
      { status: 402 },
    );
  }
  return { done: () => (quota ? recordCreation(who, quota).catch(() => {}) : Promise.resolve()) };
}
