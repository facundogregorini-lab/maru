import { sessionEmail } from "@/lib/auth";
import { googleConfigured } from "@/lib/googleAuth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  let email: string | null = null;
  try {
    email = sessionEmail(req);
  } catch (err) {
    console.error("[auth]", err instanceof Error ? err.message : err);
  }
  // `providers` le dice al diálogo de ingreso qué opciones mostrar.
  return Response.json({ email, providers: { google: googleConfigured() } }, { headers: { "Cache-Control": "no-store" } });
}
