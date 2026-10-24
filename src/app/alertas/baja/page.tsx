import type { Metadata } from "next";
import AlertUnsubscribe from "@/components/match/AlertUnsubscribe";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = { title: "Dejar de recibir alertas · Maru", robots: { index: false } };

export default async function AlertasBajaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = (await searchParams).t;
  return (
    <SiteShell>
      <section className="mx-auto max-w-lg py-10 text-center">
        <h1 className="font-display text-3xl font-bold">Alertas semanales</h1>
        <AlertUnsubscribe token={typeof t === "string" ? t : ""} />
      </section>
    </SiteShell>
  );
}
