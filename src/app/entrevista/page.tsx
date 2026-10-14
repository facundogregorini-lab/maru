import type { Metadata } from "next";
import InterviewFlow from "@/components/entrevista/InterviewFlow";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Entrená para tu entrevista · Maru",
  description: "Simulá la entrevista con una entrevistadora con IA, por voz y como en una videollamada, y recibí un informe con puntaje y respuestas más fuertes.",
};

export default function EntrevistaPage() {
  return (
    <SiteShell tagline="Entrená para tu entrevista">
      <InterviewFlow />
    </SiteShell>
  );
}
