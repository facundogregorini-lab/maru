import type { Metadata } from "next";
import AppShell from "@/components/app/AppShell";
import Link from "next/link";
import TrackerBoard from "@/components/tracker/TrackerBoard";

export const metadata: Metadata = {
  title: "Seguimiento de postulaciones · Maru",
  description: "Todas tus postulaciones en un tablero: guardadas, postuladas, entrevistas y ofertas, con lo que armaste con Maru para cada una. Se guarda en tu navegador y, si ingresás, también en tu cuenta.",
};

export default function SeguimientoPage() {
  return (
    <AppShell title="Seguimiento">
      <Link href="/seguimiento/guia" className="mb-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Cómo funciona el seguimiento</Link>
      <div id="empezar" className="scroll-mt-24"><TrackerBoard /></div>
    </AppShell>
  );
}
