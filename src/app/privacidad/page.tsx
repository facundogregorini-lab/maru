import type { Metadata } from "next";
import ForgetButton from "@/components/legal/ForgetButton";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidad · Maru",
  description: "Qué datos usa Maru, dónde quedan y para qué. La mayoría vive sólo en tu navegador.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Privacidad" updated="16 de octubre de 2026">
      <p>
        Maru está pensada para guardar lo mínimo. Tu perfil y lo que armás viven en tu navegador; si ingresás, tu cuenta guarda tu plan, tu seguimiento y tus alertas. Esta página explica qué
        datos usamos, para qué y dónde quedan.
      </p>

      <h2>Lo que queda en tu navegador</h2>
      <ul>
        <li>El perfil que Maru lee de tu CV, tus preferencias de búsqueda, las búsquedas guardadas o descartadas y tu seguimiento de postulaciones.</li>
        <li>Lo último que armaste en cada herramienta (CV, carta, guion, informe de entrevista), para que no se pierda si recargás la página.</li>
        <li>Se guarda en el almacenamiento local de tu navegador. Lo podés borrar cuando quieras con este botón (también está en Match, «Borrar mis datos») o borrando los datos del sitio.</li>
      </ul>
      <ForgetButton />

      <h2>Lo que se procesa en nuestros servidores, sin guardarse</h2>
      <ul>
        <li>
          Para leer tu CV, analizar un aviso y redactar (CV, respuestas, carta, guion, entrevista, informe y autocompletado), enviamos el contenido necesario a un proveedor de inteligencia artificial
          (Anthropic, con su modelo Claude). Se usa para responder en el momento; Maru no lo guarda en una base de datos.
        </li>
        <li>Para ordenar las búsquedas del match, tu perfil y tus preferencias viajan al servidor, se usan para el ranking y no se guardan ni se registran.</li>
        <li>Para el feedback del video, se envían la transcripción y 3 fotogramas de la toma. El video completo no sale de tu navegador.</li>
        <li>Cuando pegás el link de un aviso, nuestro servidor lo lee desde el sitio público donde está publicado.</li>
      </ul>

      <h2>Tu cuenta</h2>
      <ul>
        <li>Podés ingresar con tu cuenta de Google (recibimos tu email, tu nombre y tu foto) o con tu email: te mandamos un link de acceso, sin contraseña, a través de un proveedor de envío de emails.</li>
        <li>Al ingresar se guarda una cookie de sesión firmada en tu navegador, que dura hasta 180 días o hasta que salgas.</li>
        <li>
          En nuestra base de datos guardamos, asociado a tu email: el estado de tu plan, cuántas creaciones usaste en el mes, tu seguimiento de postulaciones (para tenerlo en todos tus
          dispositivos) y tus alertas de búsquedas. Sin cuenta, el uso del plan gratis se cuenta por la dirección IP.
        </li>
        <li>Si querés que borremos los datos de tu cuenta, escribinos y lo hacemos.</li>
      </ul>

      <h2>Chat con Maru</h2>
      <p>Lo que le escribís a Maru en el chat se envía al proveedor de inteligencia artificial para responderte, junto con un resumen de tu perfil si cargaste tu CV. No guardamos la conversación: queda en tu navegador hasta que cerrás la pestaña.</p>

      <h2>Extensión de Chrome</h2>
      <ul>
        <li>Guarda tu perfil y tu CV en el almacenamiento de la extensión, en tu computadora.</li>
        <li>Cuando tocás «Completar», envía a Maru los campos del formulario de esa página y tu perfil para decidir qué va en cada uno. No completa datos demográficos ni aceptaciones legales y nunca envía la postulación: eso lo hacés vos.</li>
      </ul>

      <h2>Dictado por voz</h2>
      <p>
        Cuando dictás o respondés por voz, el reconocimiento lo hace tu navegador. Según el navegador, el audio puede procesarse en los servidores de quien lo fabrica (por ejemplo, Google en Chrome).
      </p>

      <h2>Medición y pagos</h2>
      <ul>
        <li>Medimos visitas y el uso de las secciones de forma agregada (Vercel Analytics), sin datos personales ni cookies de publicidad.</li>
        <li>Si contratás el plan, el pago lo procesa Mercado Pago. Maru nunca ve ni guarda los datos de tu tarjeta: sólo recibe el estado de la suscripción.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Podés pedirnos acceso, corrección o eliminación de los datos que tengamos sobre vos (los de tu cuenta). Como titular de los datos, tenés los derechos que establece la Ley 25.326 de Protección
        de los Datos Personales. La Agencia de Acceso a la Información Pública es el órgano de control de esa ley.
      </p>
    </LegalPage>
  );
}
