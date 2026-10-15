import type { Metadata } from "next";
import MatchFlow from "@/components/match/MatchFlow";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Encontrá tu trabajo perfecto · Maru",
  description:
    "Subí tu CV, contanos qué querés hacer y Maru te muestra búsquedas reales donde podés trabajar desde Argentina, ordenadas por compatibilidad y con el porqué.",
};

export default function MatchPage() {
  return (
    <SiteShell tagline="Encontrá tu trabajo perfecto">
      <MatchFlow />
    </SiteShell>
  );
}
