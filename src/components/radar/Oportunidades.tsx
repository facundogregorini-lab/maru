"use client";

import Link from "next/link";
import { safeHref } from "@/lib/radar/identity";
import { Note, Pill, btn, card } from "./RadarUi";
import { useRadar } from "./useRadar";

export default function Oportunidades() {
  const { state, ready } = useRadar();
  if (!ready) return <p className="py-10 text-center text-sm text-muted">Cargando…</p>;
  const following = Object.values(state.companies).filter((c) => !c.archived).length;
  const pilot = [...state.pilot].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="flex flex-col gap-6">
      <section className={card}>
        <h2 className="text-lg font-bold">Tus mejores oportunidades</h2>
        {following === 0 ? (
          <div className="py-8 text-center">
            <p className="font-semibold">Todavía no seguís ninguna empresa</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Sumá empresas en «Mis empresas» y acá vas a ver sus búsquedas abiertas ordenadas por tu match.</p>
            <Link href="/radar/empresas" className={`${btn} mt-4`}>
              Ir a Mis empresas
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Estamos terminando la evaluación de las búsquedas de tus {following} empresas con tu match. Mientras tanto, mirá cuántas tiene abiertas cada una en «Mis empresas».</p>
        )}
      </section>

      {pilot.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">Vacantes de tu research</h2>
            <span className="text-xs text-muted">Orden: score del piloto</span>
          </div>
          <Note>
            Piloto {state.pilotDate ?? "importado"} · vigencia no verificada. Son las vacantes que relevaste en tu planilla: el score es el tuyo (editorial), no es el match de Maru ni una probabilidad de contratación.
          </Note>
          <div className="grid gap-3 md:grid-cols-2">
            {pilot.map((j) => {
              const href = safeHref(j.url);
              return (
                <article key={j.id} className={`${card} flex flex-col gap-3`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {j.company} {j.priority && <Pill>{j.priority}</Pill>}
                      </p>
                      <h3 className="mt-1 text-base font-bold leading-snug">{j.title}</h3>
                      {j.location && <p className="text-xs text-muted">{j.location}</p>}
                    </div>
                    {j.score !== null && (
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-brand-dark">
                          {j.score}
                          <span className="text-xs">/100</span>
                        </p>
                        <p className="text-[11px] text-muted">Score piloto</p>
                      </div>
                    )}
                  </div>
                  {(j.reasons || j.barriers) && (
                    <div className="rounded-lg bg-surface-5 p-3 text-sm leading-relaxed">
                      {j.reasons && (
                        <p>
                          <b>Por qué encaja:</b> {j.reasons}
                        </p>
                      )}
                      {j.barriers && <p className="mt-1 text-xs text-muted">A verificar: {j.barriers}</p>}
                    </div>
                  )}
                  <p className="text-xs text-muted">{[j.date, "vigencia no verificada"].filter(Boolean).join(" · ")}</p>
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer" className={`${btn} mt-auto self-start`}>
                      Ver aviso original ↗
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
