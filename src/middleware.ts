import { NextResponse, type NextRequest } from "next/server";
import { bucketFor, clientIp, take } from "@/lib/rateLimit";

/** Límite de uso de las rutas de IA (ver src/lib/rateLimit.ts). */
export function middleware(req: NextRequest) {
  if (req.method !== "POST") return NextResponse.next();
  const wait = take(clientIp(req.headers), bucketFor(req.nextUrl.pathname));
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
    "/api/generate",
    "/api/profile",
    "/api/cv/:path*",
    "/api/carta/:path*",
    "/api/bullet",
    "/api/entrevista/:path*",
    "/api/video/:path*",
    "/api/autofill",
    "/api/chat",
  ],
};
