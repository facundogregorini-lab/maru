"use client";

import { useState } from "react";
import type { Informe, Intercambio } from "@/lib/schemas";
import CopyButton from "../CopyButton";

function Dots({ n }: { n: number }) {
  return (
    <span className="flex gap-1" aria-label={`${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i <= Math.round(n) ? "bg-celeste" : "bg-line"}`} />
      ))}
    </span>
  );
}

export function informeToText(inf: Informe): string {
  return [
    `Entrevista de práctica · ${Math.round(inf.puntaje)}/100`,
    inf.veredicto,
    "",
    inf.resumen,
    "",
    "Fortalezas:",
    ...inf.fortalezas.map((f) => `• ${f}`),
    "",
    "A mejorar:",
    ...inf.a_mejorar.map((f) => `• ${f}`),
    "",
    ...inf.respuestas.flatMap((r, i) => [`${i + 1}. ${r.pregunta} (${r.puntaje}/5)`, `Funcionó: ${r.funciono}`, `Mejorar: ${r.mejorar}`, `Respuesta sugerida: ${r.respuesta_sugerida}`, ""]),
    "Próximos pasos:",
    ...inf.proximos_pasos.map((p) => `• ${p}`),
  ].join("\n");
}

export default function Report({ informe, historial }: { informe: Informe; historial: Intercambio[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const score = Math.round(informe.puntaje);
  const r = 46;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "var(--color-sage)" : score >= 55 ? "var(--color-honey)" : "var(--color-danger)";

  return (
    <div className="animate-rise space-y-6">
      <section className="grid items-center gap-6 rounded-[2rem] bg-sand p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        <svg viewBox="0 0 110 110" className="mx-auto h-32 w-32" role="img" aria-label={`Puntaje ${score} de 100`}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--color-paper)" strokeWidth="10" />
          <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 55 55)" />
          <text x="55" y="62" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--color-ink)">
            {score}
          </text>
        </svg>
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-celeste">Tu informe</p>
          <h1 className="mt-1 font-serif text-3xl leading-tight tracking-tight">{informe.veredicto}</h1>
          <p className="mt-2 leading-relaxed text-muted">{informe.resumen}</p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl bg-paper p-5">
          <h2 className="text-sm font-semibold text-sage">Lo que hiciste bien</h2>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
            {informe.fortalezas.map((f) => (
              <li key={f}>● {f}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-paper p-5">
          <h2 className="text-sm font-semibold text-celeste-dark">Para trabajar</h2>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
            {informe.a_mejorar.map((f) => (
              <li key={f}>○ {f}</li>
            ))}
          </ul>
        </div>
      </div>

      <section>
        <h2 className="font-serif text-2xl tracking-tight">Respuesta por respuesta</h2>
        <div className="mt-4 space-y-3">
          {informe.respuestas.map((x, i) => {
            const mine = historial.find((h) => h.pregunta === x.pregunta)?.respuesta ?? historial[i]?.respuesta;
            const isOpen = open === i;
            return (
              <div key={i} className="overflow-hidden rounded-3xl border border-line bg-paper">
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                  <span className="font-medium">
                    <span className="mr-2 font-serif text-celeste">{i + 1}.</span>
                    {x.pregunta}
                  </span>
                  <Dots n={x.puntaje} />
                </button>
                {isOpen && (
                  <div className="space-y-3 border-t border-line px-5 pb-5 pt-4 text-sm leading-relaxed">
                    {mine && (
                      <p className="rounded-2xl bg-sand/60 px-4 py-3 text-muted">
                        <b className="text-ink">Lo que respondiste:</b> {mine}
                      </p>
                    )}
                    <p>
                      <b className="text-sage">Funcionó:</b> {x.funciono}
                    </p>
                    <p>
                      <b className="text-celeste-dark">Mejorar:</b> {x.mejorar}
                    </p>
                    <div className="rounded-2xl bg-cream px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <b>Una respuesta más fuerte</b>
                        <CopyButton text={x.respuesta_sugerida} />
                      </div>
                      <p className="mt-1 whitespace-pre-line">{x.respuesta_sugerida}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="rounded-3xl bg-paper p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">Próximos pasos</h2>
          <CopyButton text={informeToText(informe)} label="Copiar informe" />
        </div>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {informe.proximos_pasos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
