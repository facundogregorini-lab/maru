import type { Metadata } from "next";
import CvBuilderFlow from "@/components/CvBuilderFlow";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Creá tu CV perfecto · Maru",
  description: "Un CV optimizado para pasar los filtros automáticos y convencer a recruiters, con más de 20 diseños personalizables.",
};

export default function CvPage() {
  return (
    <SiteShell tagline="Creá tu CV perfecto">
      <CvBuilderFlow />
    </SiteShell>
  );
}
