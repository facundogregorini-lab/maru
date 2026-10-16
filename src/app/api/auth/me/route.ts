import { getAccount, isPaid } from "@/lib/account";
import { sessionEmail } from "@/lib/auth";
import { dbEnabled } from "@/lib/db";
import { googleEnabled } from "@/lib/google";
import { paymentsEnabled } from "@/lib/plan";

export const runtime = "nodejs";

/** Quién está adentro, si tiene el plan pago y qué formas de ingreso hay. */
export async function GET(req: Request) {
  let email: string | null = null;
  try {
    email = sessionEmail(req);
  } catch (err) {
    console.error("[auth]", err instanceof Error ? err.message : err);
  }
  const account = email ? await getAccount(email).catch(() => null) : null;
  return Response.json(
    { email, name: account?.name ?? null, paid: isPaid(account), google: googleEnabled(), payments: paymentsEnabled(), db: dbEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
