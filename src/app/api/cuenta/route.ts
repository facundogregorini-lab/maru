import { FREE_MONTHLY_CREATIONS, checkCreation, getAccount, isPaid } from "@/lib/account";
import { sessionEmail } from "@/lib/auth";
import { dbEnabled } from "@/lib/db";
import { clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** El estado de la cuenta para la página /cuenta. */
export async function GET(req: Request) {
  const email = sessionEmail(req);
  if (!email) return Response.json({ error: "Ingresá para ver tu cuenta.", code: "AUTH_REQUIRED" }, { status: 401 });
  const [account, quota] = await Promise.all([getAccount(email), checkCreation({ email, ip: clientIp(req.headers) })]);
  return Response.json(
    {
      email,
      name: account?.name ?? null,
      paid: isPaid(account),
      status: account?.status ?? null,
      paidSince: account?.paidSince ?? null,
      paidUntil: account?.status === "cancelled" ? (account.paidUntil ?? null) : null,
      used: quota.used,
      limit: dbEnabled() ? FREE_MONTHLY_CREATIONS : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
