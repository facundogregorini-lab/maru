import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import { ProductHero, ProductMore, ToolHeading } from "@/components/product/ProductLanding";
import TrackerBoard from "@/components/tracker/TrackerBoard";
export const metadata: Metadata = { title: "Organizá tus postulaciones · Maru", description: "Guardá oportunidades, seguí cada postulación y prepará tus materiales desde un tablero sincronizado con tu cuenta." };
export default function SeguimientoGuiaPage() {
  return <SiteShell><ProductHero id="seguimiento" /><ToolHeading hint="Tus postulaciones, materiales y notas en un solo lugar." /><TrackerBoard /><ProductMore id="seguimiento" /></SiteShell>;
}
