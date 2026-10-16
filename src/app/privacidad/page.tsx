import type { Metadata } from "next";
import ForgetButton from "@/components/legal/ForgetButton";
import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Política de privacidad · Maru",
  description: "Qué datos usa Maru, dónde quedan y para qué. Sin cuenta, todo vive en tu navegador.",
};

export default function PrivacidadPage() {
  return (
    <LegalPage title="Privacidad" updated="16 de octubre de 2026">
      <p>
        Maru está pensada para guardar lo mínimo. Tu perfil, tus búsquedas y tu seguimiento viven en tu navegador y, si ingresás con tu email, también en tu cuenta. Esta página explica qué datos usamos, para qué y dónde quedan.
      </p>

      <h2>Lo que queda en tu navegador</h2>
      <ul>
        <li>El perfil que Maru lee de tu CV, tus preferencias de búsqueda, las búsquedas guardadas o descartadas y tu seguimiento de postulaciones.</li>
        <li>Lo último que armaste en cada herramienta (CV, carta, guion, informe de entrevista), para que no se pierda si recargás la página.</li>
        <li>Se guarda en el almacenamiento local de tu navegador. Lo podés borrar cuando quieras con este botón (también está en Match, «Borrar mis datos») o borrando los datos del sitio.</li>
      </ul>
      <ForgetButton />

      <h2>Lo que se guarda en tu cuenta, si ingresás</h2>
      <ul>
        <li>Para que los veas en cualquier dispositivo, tu perfil, tus preferencias de búsqueda, las búsquedas guardadas o descartadas y tu seguimiento se copian a una base de datos asociada a tu cuenta.</li>
        <li>Lo armado en cada herramienta (CV, carta, guion, informe de entrevista) no se copia: sigue sólo en tu navegador.</li>
        <li>Si borrás tus datos con el botón de arriba mientras estás adentro, se borran también de tu cuenta y de tus otros dispositivos.</li>
      </ul>

      <h2>Lo que se procesa en nuestros servidores, sin guardarse</h2>
      <ul>
        <li>
          Para leer tu CV, analizar un aviso y redactar (CV, respuestas, carta, guion, entrevista, informe y autocompletado), enviamos el contenido necesario a un proveedor de inteligencia artificial
          (Anthropic, con su modelo Claude). Se usa para responder en el momento; Maru no lo guarda en una base de datos.
        </li>
        <li>Para ordenar las búsquedas del match, tu perfil y tus preferencias viajan al servidor, se usan para el ranking y no se guardan ni se registran.</li>
        <li>Para el feedback del video, se envían la transcripción y 3 fotogramas de la toma. El video completo no sale de tu navegador.</li>
        <li>El chat con Maru envía tu consulta y el historial visible a la IA. Tu perfil se incluye sólo si marcás esa opción. Maru no guarda la conversación en su base.</li>
        <li>Cuando pegás el link de un aviso, nuestro servidor lo lee desde el sitio público donde está publicado.</li>
      </ul>

      <h2>Tu email y tu sesión</h2>
      <ul>
        <li>Podés ingresar con Google (usamos el email verificado que devuelve Google) o con un link de acceso que enviamos a tu email, sin contraseña. Ambos métodos abren la misma cuenta.</li>
        <li>Al ingresar se guarda una cookie de sesión firmada en tu navegador, que dura hasta 180 días o hasta que salgas.</li>
      </ul>

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
        <li>Si contratás un plan, Mercado Pago procesa el pago. Maru guarda los identificadores y el estado de la suscripción, el período acreditado y los contadores de uso; nunca ve ni guarda los datos de tu tarjeta.</li>
        <li>El botón de borrar datos elimina perfil, preferencias y seguimiento. Para detener una renovación usá Cancelar renovación en Planes. Los registros de facturación se gestionan por separado a través del contacto del sitio.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Podés pedirnos acceso, corrección o eliminación de los datos que tengamos sobre vos (tu email y, si ingresaste, lo que se guarda en tu cuenta). Como titular de los datos, tenés los derechos que establece la Ley 25.326 de Protección
        de los Datos Personales. La Agencia de Acceso a la Información Pública es el órgano de control de esa ley.
      </p>
    </LegalPage>
  );
}
