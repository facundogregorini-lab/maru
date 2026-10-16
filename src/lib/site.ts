/** URL pública del sitio (para links absolutos, sitemap y Open Graph). Con dominio propio, definir NEXT_PUBLIC_SITE_URL. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://maru-grego7.vercel.app");

/** Email de contacto para legales y soporte (NEXT_PUBLIC_CONTACT_EMAIL). Vacío si todavía no se definió. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
