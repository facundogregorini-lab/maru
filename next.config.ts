import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "mammoth"],
  outputFileTracingIncludes: {
    "/api/export/pdf": ["./node_modules/@fontsource/{inter,source-serif-4,source-sans-3}/files/*-latin*-normal.woff2"],
  },
};

export default nextConfig;
