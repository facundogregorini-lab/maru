import { after } from "next/server";
import { billingJson, billingSession } from "@/lib/billing/http";
import { lastPayment, readSubscription } from "@/lib/billing/server";
import { capiConfig, milestoneEventId, sendCapiEvent, type CapiEvent } from "@/lib/tracking/capi";
import { claimMilestone, isMilestone, type ClaimMode, type Milestone } from "@/lib/tracking/server";

export const runtime = "nodejs";

const MODES: ClaimMode[] = ["claim", "check", "mark"];

/** La compra sale a Meta sólo si es el primer pago verificado de esa suscripción, con el importe del servidor (igual que en Google). */
async function capiEvent(email: string, milestone: Milestone, id: string | undefined, eventId: string): Promise<CapiEvent | null> {
  if (milestone !== "purchase") return { milestone, eventId };
  const payment = lastPayment(await readSubscription(email));
  return payment && payment.id === id && payment.first ? { milestone, eventId, value: { amount: payment.amount, currency: payment.currency } } : null;
}

/**
 * Deduplicación de conversiones por cuenta. No recibe ni devuelve datos personales: sólo el hito, si es el primero
 * y, en ese caso, el eventID que comparten el píxel y la API de conversiones de Meta (que sale desde acá).
 */
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return billingJson({ code: "AUTH_REQUIRED" }, 401);
  const body = (await req.json().catch(() => null)) as { milestone?: unknown; id?: unknown; mode?: unknown } | null;
  const mode = MODES.find((m) => m === body?.mode) ?? "claim";
  const id = typeof body?.id === "string" ? body.id : undefined;
  if (!body || !isMilestone(body.milestone)) return billingJson({ code: "BAD_REQUEST" }, 400);
  const milestone = body.milestone;
  try {
    const { first } = await claimMilestone(email, milestone, id, mode);
    if (!first || mode !== "claim") return billingJson({ first });
    const eventId = milestoneEventId(milestone, id);
    if (capiConfig()) {
      after(async () => {
        const event = await capiEvent(email, milestone, id, eventId).catch(() => null);
        if (event) await sendCapiEvent(req, event);
      });
    }
    return billingJson({ first, eventId });
  } catch (err) {
    const bad = err instanceof Error && err.message === "Hito inválido.";
    return billingJson({ code: bad ? "BAD_REQUEST" : "UNAVAILABLE" }, bad ? 400 : 503);
  }
}
