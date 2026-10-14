import type { Metadata } from "next";
import Flow from "@/components/Flow";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Coach de postulación · Maru",
  description:
    "Pegá el link de la vacante que te gusta, contanos por qué, y Maru te devuelve un CV personalizado y respuestas para cada campo del formulario.",
};

export default function Postulacion() {
  return (
    <SiteShell tagline="Coach de postulación">
      <Flow />
    </SiteShell>
  );
}
