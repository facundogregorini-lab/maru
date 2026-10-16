"use client";

import Link from "next/link";
import { useState } from "react";

type Tool = {
  title: string;
  short: string;
  body: string;
  bullets: string[];
  cta: string;
  href: string;
};

const TOOLS: Tool[] = [
  {
    title: "CV optimizado",
    short: "Pasá los filtros y ganá la búsqueda",
    body: "Un CV 100% optimizado para pasar los filtros automáticos y ganar las búsquedas. Más de 20 diseños para personalizar.",
    bullets: ["Palabras clave del ATS, sólo donde son verdad", "Más de 20 diseños", "Descargá en PDF o Word"],
    cta: "Crear mi CV",
    href: "/cv",
  },
  {
    title: "Carta de presentación",
    short: "Por qué sos la persona indicada",
    body: "Cargá la búsqueda, contá lo tuyo por escrito o en un audio, y te armamos una carta a medida que muestra por qué sos la persona indicada.",
    bullets: ["Escrita o en audio", "A medida de cada búsqueda", "Sin frases genéricas"],
    cta: "Armar mi carta",
    href: "/carta",
  },
  {
    title: "Video de presentación",
    short: "Guion, teleprompter y feedback",
    body: "Guion a medida, teleprompter mientras grabás con tu cámara y feedback de cada toma: ritmo, mirada y luz.",
    bullets: ["Guion a medida", "Teleprompter en pantalla", "Feedback de cada toma"],
    cta: "Grabar mi video",
    href: "/video",
  },
  {
    title: "Entrená tu entrevista",
    short: "Simulación por voz con informe",
    body: "Simulá la entrevista por voz, como en una videollamada, y recibí un informe con puntaje y respuestas más fuertes.",
    bullets: ["Como una videollamada real", "Informe con puntaje", "Respuestas más fuertes"],
    cta: "Practicar ahora",
    href: "/entrevista",
  },
];

/** Las herramientas del coach de postulación, ya desplegadas: una abierta y el resto a un clic. */
export default function PostulacionTools() {
  const [active, setActive] = useState(0);
  const cur = TOOLS[active];

  return (
    <div className="relative mt-8">
      <p className="text-sm font-medium text-muted">También podés trabajar cada pieza por separado:</p>
      <div role="tablist" aria-label="Herramientas de postulación" className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.title}
              type="button"
              role="tab"
              id={`tool-tab-${i}`}
              aria-selected={on}
              aria-controls="tool-panel"
              onClick={() => setActive(i)}
              className={`press flex min-h-24 flex-col items-start gap-1.5 rounded-2xl p-4 text-left ring-1 transition-shadow duration-300 ${
                on ? "bg-paper shadow-[0_18px_40px_-24px_rgba(21,82,126,0.55)] ring-celeste/40" : "bg-paper/50 ring-line/80 hover:bg-paper hover:ring-celeste/30"
              }`}
            >
              <span className={`font-medium ${on ? "text-celeste-dark" : ""}`}>{t.title}</span>
              <span className="text-sm leading-snug text-muted">{t.short}</span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="tool-panel"
        aria-labelledby={`tool-tab-${active}`}
        key={active}
        className="animate-rise mt-2.5 flex flex-col gap-5 rounded-2xl bg-paper p-5 ring-1 ring-line/70 sm:p-6 lg:flex-row lg:items-center lg:gap-8"
      >
        <div className="min-w-0 lg:flex-[1.4]">
          <p className="font-serif text-3xl">{cur.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{cur.body}</p>
        </div>
        <ul className="space-y-2 text-sm lg:flex-1">
          {cur.bullets.map((b) => (
            <li key={b} className="flex items-center gap-2.5">
              <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-celeste-soft text-[9px] text-celeste-dark">✓</span>
              {b}
            </li>
          ))}
        </ul>
        <Link
          href={cur.href}
          className="press inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full bg-celeste px-5 py-3 font-medium text-white shadow-[0_14px_30px_-12px_rgba(31,111,168,0.7)] hover:bg-celeste-dark lg:self-center"
        >
          {cur.cta} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
