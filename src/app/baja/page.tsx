import type { Metadata } from "next";
import Link from "next/link";
import SelfService from "@/components/billing/SelfService";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Botón de baja · Maru", description: "Cancelá tu suscripción a Maru online, sin permanencia ni cargos por baja." };

export default function BajaPage() {
  return (
    <LegalPage title="Botón de baja" updated="22 de octubre de 2026">
      <p>Cancelás tu suscripción online, con una sola confirmación y sin cargos por baja. No se te cobra más y conservás el acceso hasta que termine el período que ya pagaste. Ves el número de solicitud en pantalla en el momento.</p>
      <SelfService mode="baja" />
      <p>
        La baja no devuelve el período en curso. Si querés la devolución de tu primer pago, mirá la garantía de 14 días en <Link href="/precios#como-cancelar" className="underline underline-offset-4">Planes</Link> o el{" "}
        <Link href="/arrepentimiento" className="underline underline-offset-4">Botón de arrepentimiento</Link>.
      </p>
    </LegalPage>
  );
}
