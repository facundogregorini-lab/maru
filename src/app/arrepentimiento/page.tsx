import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import AccountPanel from "@/components/plan/AccountPanel";

export const metadata: Metadata = {
  title: "Botón de arrepentimiento · Maru",
  description: "Arrepentite de la compra del plan Maru dentro de los 10 días corridos (Ley 24.240 y Resolución 424/2020).",
};

export default function ArrepentimientoPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:pt-16">
        <h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">Botón de arrepentimiento</h1>
        <p className="mt-4 leading-relaxed text-ink/80">
          Si contrataste el plan Maru, podés arrepentirte dentro de los 10 días corridos desde la contratación, sin dar motivos (Ley 24.240 de Defensa del Consumidor y
          Resolución 424/2020). Damos de baja la suscripción en Mercado Pago y te devolvemos lo que pagaste en el mismo medio de pago.
        </p>
        <div className="mt-8">
          <AccountPanel regret />
        </div>
      </div>
    </SiteShell>
  );
}
