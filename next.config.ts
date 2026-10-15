import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Se cargan desde node_modules en runtime (no se empaquetan con webpack).
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "mammoth"],
  outputFileTracingIncludes: {
    // Inventario compartido de vacantes (lo genera la sincronización programada).
    "/api/match/**": ["./data/match/*.json"],
    "/api/export/pdf": [
      // Chromium comprimido: nadie lo importa, así que el tracing no lo detecta solo.
      // Sin esto, chromium.executablePath() falla en Vercel ("bin does not exist").
      "./node_modules/@sparticuz/chromium/bin/**",
      "./node_modules/@fontsource/{inter,source-serif-4,source-sans-3}/files/*-latin*-normal.woff2",
    ],
  },
};

export default nextConfig;
