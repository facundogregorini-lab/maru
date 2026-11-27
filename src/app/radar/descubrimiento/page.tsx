import Link from "next/link";
import { EmptyState, btnDark } from "@/components/radar/ui";

/** Etapa 1: sólo el layout. Las sugerencias semanales llegan en la sesión 4. */
export default function RadarDescubrimientoPage() {
  return (
    <EmptyState title="Todavía no hay sugerencias" actions={<Link href="/radar/empresas" className={btnDark}>Agregar empresas</Link>}>
      <p>
        Maru va a proponerte entre 5 y 10 empresas por semana según tu perfil, los sectores que seguís y lo que marques como «No me interesa».
        Sólo con señales que tengan fecha y fuente; lo que no se pueda verificar va a aparecer como pendiente.
      </p>
    </EmptyState>
  );
}
