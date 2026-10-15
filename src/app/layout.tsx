import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
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

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: "Maru Coach · Encontrá tu trabajo perfecto con IA",
  description:
    "Cruzamos tu perfil con las miles de búsquedas abiertas en el mercado, personalizamos cada postulación y aplicamos por vos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
