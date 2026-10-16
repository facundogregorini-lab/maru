import type { Metadata } from "next";
import MatchFlow from "@/components/match/MatchFlow";
import SiteShell from "@/components/SiteShell";
import { landingData } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Match con IA · Maru",
  description:
    "Subí tu CV, contanos qué querés hacer y Maru te muestra búsquedas reales donde podés trabajar desde Argentina, ordenadas por compatibilidad y con el porqué.",
};

// Los números del hero salen del inventario real; se regeneran cada hora.
export const revalidate = 3600;

const fmt = (n: number) => n.toLocaleString("es-AR");

export default async function MatchPage() {
  const d = await landingData();
  return (
    <SiteShell>
      <MatchFlow
        stats={[
          { value: `${fmt(d.total)}+`, label: "búsquedas abiertas hoy" },
          { value: fmt(d.companies), label: "empresas que están contratando" },
          { value: fmt(d.eligible), label: "que podés tomar desde Argentina" },
        ]}
      />
    </SiteShell>
  );
}
