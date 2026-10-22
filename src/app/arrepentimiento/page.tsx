import type { Metadata } from "next";
import Link from "next/link";
import SelfService from "@/components/billing/SelfService";
import LegalPage from "@/components/legal/LegalPage";
import { GUARANTEE_DAYS, WITHDRAWAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Botón de arrepentimiento · Maru", description: "Arrepentite de tu compra en Maru y pedí la devolución online." };

export default function ArrepentimientoPage() {
  return (
    <LegalPage title="Botón de arrepentimiento" updated="22 de octubre de 2026">
      <p>
        Tenés derecho a arrepentirte dentro de los {WITHDRAWAL_DAYS} días corridos desde que contrataste (Ley 24.240, art. 34). Además, Maru ofrece una garantía de {GUARANTEE_DAYS} días en tu primera
        contratación, aunque hayas usado el servicio. Desde acá pedís la devolución del 100% de tu primer pago y cancelamos las renovaciones.
      </p>
      <SelfService mode="devolucion" />
      <p>
        Ves el número de solicitud en pantalla en el momento. Pedimos el reembolso a Mercado Pago en el acto; la acreditación depende de tu medio de pago y de tu banco. Si pasaron los plazos, podés igual
        cancelar las renovaciones desde el <Link href="/baja" className="underline underline-offset-4">Botón de baja</Link>.
      </p>
    </LegalPage>
  );
}
