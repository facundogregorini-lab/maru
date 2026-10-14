import type { Metadata } from "next";
import CartaFlow from "@/components/carta/CartaFlow";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Carta de presentación · Maru",
  description: "Traé la búsqueda, contanos qué querés transmitir (también por audio) y Maru escribe tu carta de presentación, lista para PDF o Word.",
};

export default function CartaPage() {
  return (
    <SiteShell tagline="Carta de presentación">
      <CartaFlow />
    </SiteShell>
  );
}
