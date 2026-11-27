import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Radar laboral: el mismo flag del servidor, copiado al build para que la navegación ni lo consulte si está apagado.
  env: { NEXT_PUBLIC_RADAR_ENABLED: process.env.RADAR_ENABLED?.trim().toLowerCase() === "true" ? "true" : "" },
  // Se cargan desde node_modules en runtime (no se empaquetan con webpack).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "mammoth"],
  outputFileTracingIncludes: {
    // Inventario compartido de vacantes (lo genera la sincronización programada).
    "/api/match/**": ["./data/match/*.json"],
    // El copiloto y las alertas semanales rankean con el mismo inventario.
    "/api/copiloto": ["./data/match/*.json"],
    "/api/cron/alertas": ["./data/match/*.json"],
    "/busquedas": ["./data/match/inventory*.json"],
    "/busquedas/[id]": ["./data/match/inventory*.json"],
    // La home lee los números del inventario al regenerarse (ISR).
    "/": ["./data/match/inventory*.json"],
    "/match": ["./data/match/inventory*.json"],
    "/api/export/pdf": [
      // Chromium comprimido: nadie lo importa, así que el tracing no lo detecta solo.
      // Sin esto, chromium.executablePath() falla en Vercel ("bin does not exist").
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/@fontsource/{inter,source-serif-4,source-sans-3}/files/*-latin*-normal.woff2",
    ],
  },
};

export default nextConfig;
