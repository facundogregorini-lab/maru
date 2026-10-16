import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = { title: "Alertas · Maru", robots: { index: false } };

export default async function BajaAlertasPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = !!(await searchParams).error;
  return (
    <SiteShell>
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">{error ? "El link venció" : "Listo"}</h1>
        <p className="mt-3 text-ink/75">
          {error ? "No pudimos darte de baja con ese link. Entrá a «Mi cuenta» y borrá tus alertas desde ahí." : "No te vamos a mandar más alertas de búsquedas. Podés volver a crearlas cuando quieras."}
        </p>
        <Link href={error ? "/cuenta" : "/busquedas"} className="press mt-8 inline-flex rounded-full bg-ink px-6 py-3 font-semibold text-white">
          {error ? "Ir a mi cuenta" : "Ver búsquedas"}
        </Link>
      </div>
    </SiteShell>
  );
}
