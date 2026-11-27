import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import RadarTabs from "@/components/radar/RadarTabs";
import { SESSION_COOKIE } from "@/lib/auth";
import { radarAllowedToken } from "@/lib/radar/access";

export const metadata: Metadata = {
  title: "Radar laboral · Maru",
  description: "Elegí las empresas donde te gustaría trabajar y Maru revisa sus búsquedas por vos.",
  robots: { index: false, follow: false },
};

// El acceso depende del feature flag y de la sesión: nunca se cachea.
export const dynamic = "force-dynamic";

export default async function RadarLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  if (!radarAllowedToken(jar.get(SESSION_COOKIE)?.value)) notFound();
  return (
    <AppShell title="Radar laboral">
      <div className="mx-auto max-w-[1180px] pt-2">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[26px]">Elegí dónde te gustaría trabajar</h1>
          <p className="mt-1 text-sm text-muted">Maru revisa las búsquedas de esas empresas y te muestra las que encajan con tu perfil.</p>
        </div>
        <RadarTabs />
        {children}
      </div>
    </AppShell>
  );
}
