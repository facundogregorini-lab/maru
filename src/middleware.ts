import { NextResponse, type NextRequest } from "next/server";
import { bucketFor, clientIp, takeShared } from "@/lib/rateLimit";

/** Límite de uso de las rutas de IA (ver src/lib/rateLimit.ts). */
export async function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  let wait: number;
  try { wait = await takeShared(clientIp(req.headers), bucketFor(req.nextUrl.pathname)); }
  catch {
    return NextResponse.json({ error: "No pudimos comprobar el límite de uso. Probá en un momento.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "30" } });
  }
  if (!wait) return NextResponse.next();
  const minutes = Math.max(1, Math.ceil(wait / 60));
  return NextResponse.json(
    { error: `Usaste Maru mucho en poco tiempo. Esperá ${minutes} ${minutes === 1 ? "minuto" : "minutos"} y seguimos.`, code: "RATE_LIMIT" },
    { status: 429, headers: { "Retry-After": String(wait) } },
  );
}

export const config = {
  matcher: [
    "/api/analyze",
    "/api/chat",
    "/api/billing/checkout",
    "/api/billing/cancel",
    "/api/billing/status",
    "/api/generate",
    "/api/profile",
    "/api/cv/:path*",
    "/api/carta/:path*",
    "/api/bullet",
    "/api/entrevista/:path*",
    "/api/video/:path*",
    "/api/autofill",
    "/api/export/:path*",
    "/api/auth/request",
    "/api/tracking/:path*",
  ],
};
