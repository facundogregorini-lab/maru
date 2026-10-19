import type { Metadata } from "next";
import { Inter, Titillium_Web } from "next/font/google";
// Fuentes de los templates de CV (las mismas que se embeben en el PDF).
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";
import PaywallHost from "@/components/billing/PaywallHost";
import LoginHost from "@/components/auth/LoginHost";
import PostHogPageviews from "@/components/PostHogPageviews";
import { SITE_URL } from "@/lib/site";
import { googleTagSnippet, metaPixelSnippet } from "@/lib/tracking/tag";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const titillium = Titillium_Web({ subsets: ["latin"], weight: ["300", "400", "600", "700"], variable: "--font-titillium" });

const DESCRIPTION =
  "Búsquedas reales que podés tomar desde Argentina, ordenadas por compatibilidad con tu CV. Maru adapta tu CV y tu carta a cada aviso, completa formularios y te entrena para la entrevista.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Maru Coach · Encontrá tu trabajo perfecto con IA",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Maru Coach",
    title: "Maru Coach · Tu coach de carrera con IA",
    description: DESCRIPTION,
    images: [{ url: "/video/maru-intro-poster.jpg", alt: "Maru Coach" }],
  },
  twitter: { card: "summary_large_image", title: "Maru Coach · Tu coach de carrera con IA", description: DESCRIPTION, images: ["/video/maru-intro-poster.jpg"] },
};

// Sólo en el deploy de producción de Vercel; el script además verifica el dominio en el navegador.
const GOOGLE_TAG = process.env.VERCEL_ENV === "production" ? googleTagSnippet() : null;
const META_PIXEL = process.env.VERCEL_ENV === "production" ? metaPixelSnippet() : null;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: el script de abajo agrega la clase "js" antes de que React hidrate.
    <html lang="es" className={`${inter.variable} ${titillium.variable}`} suppressHydrationWarning>
      <head>
        {/* Las animaciones de entrada sólo esconden contenido si hay JavaScript para mostrarlo. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {/* Vercel Analytics sin dependencia: sólo cuenta visitas y los eventos de track(); se activa en el panel de Vercel. */}
        <script dangerouslySetInnerHTML={{ __html: "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};" }} />
        {process.env.VERCEL && <script defer src="/_vercel/insights/script.js" />}
        {/* Etiqueta de Google (Google Ads) directa, sin GTM: una sola carga para todo el sitio. Ver src/lib/tracking/tag.ts. */}
        {GOOGLE_TAG && <script dangerouslySetInnerHTML={{ __html: GOOGLE_TAG }} />}
        {/* Píxel de Meta de Maru, directo y sin GTM. Ver src/lib/tracking/tag.ts y meta.ts. */}
        {META_PIXEL && <script dangerouslySetInnerHTML={{ __html: META_PIXEL }} />}
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          {children}
          <PaywallHost />
          <LoginHost />
          <PostHogPageviews />
        </AuthProvider>
      </body>
    </html>
  );
}
