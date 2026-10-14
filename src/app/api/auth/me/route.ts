import { sessionEmail } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let email: string | null = null;
  try {
    email = sessionEmail(req);
  } catch (err) {
    console.error("[auth]", err instanceof Error ? err.message : err);
  }
  return Response.json({ email }, { headers: { "Cache-Control": "no-store" } });
}
