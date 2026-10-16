import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Términos y condiciones · Maru",
  description: "Las reglas de uso de Maru Coach, explicadas en simple.",
};

export default function TerminosPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="16 de octubre de 2026">
      <p>Al usar Maru Coach aceptás estos términos. Los escribimos en simple para que se entiendan.</p>

      <h2>Qué es Maru</h2>
      <p>
        Maru es un coach de carrera con inteligencia artificial: muestra búsquedas laborales publicadas por terceros, las ordena según tu perfil y te ayuda a preparar CV, cartas, respuestas, videos y
        entrevistas. No es una agencia de empleo, no representa a las empresas que publican las búsquedas y no envía postulaciones por vos.
      </p>

      <h2>Lo que Maru no garantiza</h2>
      <ul>
        <li>Conseguir entrevistas ni empleo: Maru mejora tus chances, pero cada proceso depende de la empresa.</li>
        <li>Que las búsquedas sigan abiertas o que los datos del aviso sean exactos: vienen de fuentes públicas y pueden cambiar. Ante cualquier diferencia, vale el aviso original.</li>
        <li>Que lo que redacta la IA no tenga errores. Revisá todo antes de enviarlo.</li>
      </ul>

      <h2>Tu responsabilidad</h2>
      <ul>
        <li>Que la información que cargás sea verdadera. Maru no inventa experiencia y vos tampoco deberías.</li>
        <li>Revisar y enviar cada postulación. Lo que mandás a una empresa es tuyo.</li>
        <li>No usar Maru para fines ilegales, para cargar datos de otras personas sin permiso, ni para sobrecargar o copiar el servicio de forma automatizada.</li>
      </ul>

      <h2>Contenido</h2>
      <p>Lo que creás con Maru (tu CV, tus cartas, tus guiones) es tuyo. La marca, el diseño y el software de Maru son nuestros.</p>

      <h2>Plan pago</h2>
      <p>
        Maru puede ofrecer un plan pago con suscripción mensual. El precio, lo que incluye, la renovación y cómo darlo de baja se informan antes de pagar. Podés arrepentirte de la compra dentro de los 10 días
        corridos, como establece la Ley 24.240 de Defensa del Consumidor.
      </p>

      <h2>Cambios y disponibilidad</h2>
      <p>Podemos mejorar, cambiar o discontinuar funciones. Si cambian estos términos de forma importante, lo avisamos en el sitio.</p>

      <h2>Privacidad</h2>
      <p>
        Cómo usamos tus datos está en la{" "}
        <Link href="/privacidad" className="underline underline-offset-4">
          política de privacidad
        </Link>
        .
      </p>

      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República Argentina.</p>
    </LegalPage>
  );
}
