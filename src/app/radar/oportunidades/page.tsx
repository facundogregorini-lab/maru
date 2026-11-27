import Link from "next/link";
import { EmptyState, Stat, btnDark, btnGhost } from "@/components/radar/ui";

/** Etapa 1: sólo el layout. Las vacantes llegan cuando haya fuentes verificadas (sesión 3). */
export default function RadarOportunidadesPage() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nuevas" value="—" hint="Desde tu última visita" />
        <Stat label="Match alto" value="—" hint="Todavía sin evaluar" />
        <Stat label="Empresas revisadas" value="—" hint="Sin fuentes verificadas" />
        <Stat label="Última actualización" value="—" hint="Sin revisiones" />
      </div>
      <EmptyState
        title="Todavía no hay fuentes verificadas"
        actions={
          <>
            <Link href="/radar/empresas" className={btnDark}>Ir a Mis empresas</Link>
            <Link href="/match" className={btnGhost}>Ver mi match</Link>
          </>
        }
      >
        <p>
          Cuando Maru revise las páginas de Careers de las empresas que seguís, acá vas a ver sus vacantes con el motivo del match y la fuente oficial.
          Las vacantes del piloto que importaste son históricas: no se muestran como abiertas hasta comprobarlas.
        </p>
      </EmptyState>
    </div>
  );
}
