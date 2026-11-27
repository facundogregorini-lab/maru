import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import RadarSubnav from "@/components/radar/RadarSubnav";
import { radarPageAllowed } from "@/lib/radar/page-gate";

export const metadata: Metadata = {
  title: "Radar laboral · Maru",
  description: "Seguí a las empresas donde te gustaría trabajar.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Radar laboral (detrás de RADAR_ENABLED). Apagado o fuera de la allowlist: 404. */
export default async function RadarLayout({ children }: { children: React.ReactNode }) {
  if (!(await radarPageAllowed())) notFound();
  return (
    <AppShell title="Radar laboral">
      <div className="mx-auto w-full max-w-6xl">
        <p className="mb-3 text-sm text-muted sm:text-base">Elegí dónde te gustaría trabajar. Maru busca oportunidades por vos.</p>
        <RadarSubnav />
        <div className="mt-4">{children}</div>
      </div>
    </AppShell>
  );
}
