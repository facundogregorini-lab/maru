import { billingJson, billingSession } from "@/lib/billing/http";
import { claimMilestone, isMilestone, type ClaimMode } from "@/lib/tracking/server";

export const runtime = "nodejs";

const MODES: ClaimMode[] = ["claim", "check", "mark"];

/** Deduplicación de conversiones por cuenta. No recibe ni devuelve datos personales: sólo el hito y si es el primero. */
export async function POST(req: Request) {
  const email = billingSession(req);
  if (!email) return billingJson({ code: "AUTH_REQUIRED" }, 401);
  const body = (await req.json().catch(() => null)) as { milestone?: unknown; id?: unknown; mode?: unknown } | null;
  const mode = MODES.find((m) => m === body?.mode) ?? "claim";
  const id = typeof body?.id === "string" ? body.id : undefined;
  if (!body || !isMilestone(body.milestone)) return billingJson({ code: "BAD_REQUEST" }, 400);
  try {
    return billingJson(await claimMilestone(email, body.milestone, id, mode));
  } catch (err) {
    const bad = err instanceof Error && err.message === "Hito inválido.";
    return billingJson({ code: bad ? "BAD_REQUEST" : "UNAVAILABLE" }, bad ? 400 : 503);
  }
}
