import { startGoogleLogin } from "@/lib/googleAuth";

export const runtime = "nodejs";

/** "Continuar con Google": redirige a la pantalla de Google. */
export function GET(req: Request) {
  return startGoogleLogin(req);
}
