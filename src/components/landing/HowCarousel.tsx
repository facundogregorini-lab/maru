"use client";

import { useEffect, useState } from "react";

/** La tarjeta negra de jobright (la cita destacada con puntitos): acá, cómo trabaja Maru en cada frente. */
export default function HowCarousel({ slides, avatar }: { slides: { kicker: string; title: string; how: string }[]; avatar: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const s = slides[i];
  return (
    <div className="mx-auto mt-16 max-w-[1200px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="grid min-h-[280px] overflow-hidden rounded-[24px] rounded-tr-[64px] bg-[#111] text-white sm:grid-cols-[312px_1fr]">
        <div className="flex flex-col items-start justify-center px-6 pt-8 sm:items-center sm:py-12 sm:text-center">
          {avatar}
          <p className="mt-3 font-semibold">Maru</p>
          <p className="text-xs text-white/70">
            {s.kicker} · {s.title}
          </p>
        </div>
        <div className="relative px-6 pb-10 pt-6 sm:border-l sm:border-white/20 sm:py-12 sm:pl-7 sm:pr-14" aria-live="polite">
          <span aria-hidden className="absolute left-6 right-6 top-0 border-t border-white/20 sm:hidden" />
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
            <path d="M3 18 7 6h4l-3 12zm9 0 4-12h4l-3 12z" fill="currentColor" />
          </svg>
          <p key={i} className="animate-rise mt-3 text-lg leading-relaxed sm:text-xl">
            {s.how}
          </p>
        </div>
      </div>
      <div className="mt-5 flex justify-center gap-2">
        {slides.map((sl, n) => (
          <button
            key={sl.title}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Ver: ${sl.title}`}
            aria-current={n === i || undefined}
            className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-ink" : "w-2 bg-ink/20 hover:bg-ink/40"}`}
          />
        ))}
      </div>
    </div>
  );
}
