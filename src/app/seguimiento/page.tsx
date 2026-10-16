import type { Metadata } from "next";
import AppShell from "@/components/app/AppShell";
import TrackerBoard from "@/components/tracker/TrackerBoard";

export const metadata: Metadata = {
  title: "Seguimiento de postulaciones · Maru",
  description: "Todas tus postulaciones en un tablero: guardadas, postuladas, entrevistas y ofertas, con lo que armaste con Maru para cada una. Vive sólo en tu navegador.",
};

export default function SeguimientoPage() {
  return (
    <AppShell title="Seguimiento">
      <TrackerBoard />
    </AppShell>
  );
}
