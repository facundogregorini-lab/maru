"use client";

import Link from "next/link";
import { btn, card } from "./RadarUi";

export default function Descubrimiento() {
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Empresas que Maru descubrió para vos</h2>
      <div className="py-8 text-center">
        <p className="font-semibold">Todavía no hay sugerencias</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Cada semana Maru te va a proponer empresas parecidas a las que seguís, con el motivo y su página de empleo. Nunca te sugerimos una que ya seguís o que rechazaste.
        </p>
        <Link href="/radar/empresas" className={`${btn} mt-4`}>
          Buscar en el catálogo
        </Link>
      </div>
    </section>
  );
}
