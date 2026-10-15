import { finishGoogleLogin } from "@/lib/googleAuth";

export const runtime = "nodejs";

/** Google vuelve acá con el código: validamos y dejamos la misma sesión que el magic link. */
export function GET(req: Request) {
  return finishGoogleLogin(req);
}
