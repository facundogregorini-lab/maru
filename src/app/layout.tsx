import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
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

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument" });

export const metadata: Metadata = {
  title: "Maru Coach · Encontrá tu trabajo perfecto con IA",
  description:
    "Cruzamos tu perfil con las miles de búsquedas abiertas en el mercado, personalizamos cada postulación y aplicamos por vos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: el script de abajo agrega la clase "js" antes de que React hidrate.
    <html lang="es" className={`${geist.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        {/* Las animaciones de entrada sólo esconden contenido si hay JavaScript para mostrarlo. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
