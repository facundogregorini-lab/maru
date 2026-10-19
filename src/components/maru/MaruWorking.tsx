"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MaruDesk } from "./PixelMaru";
import type { DeskFrame } from "./sprite";

/**
 * Cuántas esperas de Maru hay en pantalla. Mientras haya alguna, el Maru del rincón (MaruCompanion) se esconde:
 * "se mudó" al centro a trabajar. Es un contador y no un evento porque la espera puede montarse antes que el rincón.
 */
let working = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export function useMaruAway(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => working > 0,
    () => false,
  );
}

const DOTS = [".", "..", "...", "..", "."];

/**
 * Pantalla de espera: Maru en el centro, tecleando en la compu, con puntos que avanzan y lo que
 * está haciendo en cada momento. Con "reducir movimiento" queda quieta y sólo cambia el texto.
 */
export default function MaruWorking({ title, steps, note, every = 2600 }: { title: string; steps: string[]; note?: string; every?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const [dot, setDot] = useState(0);
  const [step, setStep] = useState(0);

  // El Maru del rincón se esconde mientras esta trabaja en el centro.
  useEffect(() => {
    working++;
    notify();
    return () => {
      working--;
      notify();
    };
  }, []);
  const cut = title.lastIndexOf(" ");

  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dots = window.setInterval(() => setDot((d) => (d + 1) % DOTS.length), 380);
    const msgs = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), every);
    // Tecleo: alterna las manos y cada tanto se queda pensando (sin re-render: cambia data-frame).
    let n = 0;
    const type = still
      ? 0
      : window.setInterval(() => {
          n++;
          const frame: DeskFrame = n % 23 === 0 ? "think" : n % 2 ? "typeA" : "typeB";
          svg.current?.setAttribute("data-frame", frame);
        }, 170);
    return () => {
      clearInterval(dots);
      clearInterval(msgs);
      if (type) clearInterval(type);
    };
  }, [steps.length, every]);

  return (
    <div role="status" aria-live="polite" aria-busy className="flex flex-col items-center px-4 py-14 text-center sm:py-20">
      <div className="relative">
        <MaruDesk ref={svg} size={168} />
        {[
          ["</>", "-30px", "0s"],
          ["✓", "-6px", "0.9s"],
          ["{ }", "-46px", "1.8s"],
        ].map(([t, dx, delay]) => (
          <span
            key={t}
            aria-hidden
            className="maru-code absolute left-[6px] top-[70px] rounded bg-ink px-1.5 font-mono text-xs font-bold leading-5 text-neon"
            style={{ "--dx": dx, animationDelay: delay } as React.CSSProperties}
          >
            {t}
          </span>
        ))}
        <span aria-hidden className="mx-auto mt-0.5 block h-2 w-40 rounded-full bg-black/10 blur-[3px]" />
      </div>
      <p className="mt-6 font-display text-2xl tracking-tight">
        {title.slice(0, cut + 1)}
        {/* La última palabra y los puntos no se separan de línea. */}
        <span className="whitespace-nowrap">
          {title.slice(cut + 1)}
          <span aria-hidden className="inline-block w-8 text-left">
            {DOTS[dot]}
          </span>
        </span>
      </p>
      <p className="mt-2 min-h-5 text-sm text-muted">{steps[step]}</p>
      {note && <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

/** Puntos que avanzan, para avisos chicos ("Afinando el orden con IA…"). */
export function WorkingDots() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setDot((d) => (d + 1) % DOTS.length), 380);
    return () => clearInterval(t);
  }, []);
  return (
    <span aria-hidden className="inline-block w-5 text-left">
      {DOTS[dot]}
    </span>
  );
}
