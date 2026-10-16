"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Demo animada de la extensión: un formulario de postulación que se completa solo,
 * campo por campo, con los colores reales (verde: del CV; amarillo: redactado por Maru).
 * Arranca al verse; con movimiento reducido se muestra ya completo.
 */
const FIELDS = [
  { label: "Nombre completo", value: "Ana Pérez" },
  { label: "Email", value: "ana.perez@gmail.com" },
  { label: "LinkedIn", value: "linkedin.com/in/anaperez" },
  { label: "CV", value: "CV-Ana-Perez.pdf", file: true },
  { label: "¿Por qué querés trabajar en Tucán?", value: "Lideré el checkout de Ualá y bajé los errores de pago un 32%. Quiero hacer lo mismo en Tucán.", review: true },
];

const STEP_MS = 900;

export default function AutofillDemo() {
  const ref = useRef<HTMLDivElement>(null);
  // -1: esperando el clic; 0..n-1: campos completos; n: listo.
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(FIELDS.length);
      return;
    }
    let timer = 0;
    let running = false;
    const run = (s: number) => {
      setStep(s);
      // Al terminar, se queda un rato mostrando el resultado y vuelve a empezar.
      const next = s >= FIELDS.length ? -1 : s + 1;
      const wait = s === -1 ? 1300 : s >= FIELDS.length ? 3800 : STEP_MS;
      timer = window.setTimeout(() => running && run(next), wait);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        run(-1);
      } else if (!e.isIntersecting && running) {
        running = false;
        clearTimeout(timer);
      }
    });
    io.observe(el);
    return () => {
      running = false;
      clearTimeout(timer);
      io.disconnect();
    };
  }, []);

  const done = step >= FIELDS.length;

  return (
    <div ref={ref} className="relative" aria-label="Demostración: la extensión completa un formulario de postulación" role="img">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(circle_at_70%_30%,rgba(88,196,211,0.18),transparent_60%)]" />
      <div className="overflow-hidden rounded-2xl bg-paper shadow-[0_40px_80px_-40px_rgba(21,82,126,0.5)] ring-1 ring-line">
        {/* Barra del navegador */}
        <div className="flex items-center gap-3 border-b border-line bg-sand/70 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </div>
          <span className="min-w-0 flex-1 truncate rounded-md bg-paper px-2.5 py-1 text-[11px] text-muted ring-1 ring-line/70">jobs.lever.co/tucan/senior-frontend/apply</span>
          <span
            className={`grid h-6 w-6 place-items-center rounded-md bg-ink font-serif text-xs italic text-paper transition-transform duration-300 ${step === -1 ? "scale-110 ring-4 ring-celeste/30" : ""}`}
          >
            m
          </span>
        </div>

        <div className="space-y-3 p-5">
          {FIELDS.map((f, i) => {
            const filled = step >= i;
            const tone = f.review ? "ring-honey/70 bg-[#fdf6e7]" : "ring-sage/60 bg-sage-soft/50";
            return (
              <div key={f.label}>
                <p className="mb-1 text-[11px] font-medium text-muted">{f.label}</p>
                <div
                  className={`relative min-h-9 rounded-lg px-3 py-2 text-[13px] ring-1 transition-[box-shadow,background-color] duration-500 ${
                    filled ? tone : "bg-paper ring-line"
                  } ${f.review ? "min-h-14" : ""}`}
                >
                  <span
                    className="block transition-[clip-path] ease-out"
                    style={{
                      clipPath: filled ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
                      transitionDuration: filled ? `${f.review ? 800 : 500}ms` : "0ms",
                    }}
                  >
                    {f.file ? (
                      <span className="inline-flex items-center gap-1.5 rounded bg-paper px-1.5 py-0.5 font-medium ring-1 ring-line">📎 {f.value}</span>
                    ) : (
                      f.value
                    )}
                  </span>
                  {filled && f.review && (
                    <span className="absolute -top-2 right-2 rounded-full bg-honey px-2 py-0.5 text-[10px] font-semibold text-white">revisá</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aviso de la extensión */}
      <div
        className={`absolute -bottom-5 right-4 flex max-w-[260px] items-start gap-2.5 rounded-2xl bg-paper p-3 text-[12px] leading-snug shadow-[0_20px_40px_-20px_rgba(14,27,44,0.45)] ring-1 ring-line transition-all duration-500 ${
          done ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-ink font-serif text-[10px] italic text-paper">m</span>
        <span>
          <strong className="font-semibold">Listo: 5 campos.</strong> Revisá el amarillo y enviá cuando quieras.
        </span>
      </div>
    </div>
  );
}
