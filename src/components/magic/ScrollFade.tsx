"use client";

import { useEffect, useRef } from "react";

/**
 * Como en jobright: el texto de cada función se ve pleno cuando está en el centro de la pantalla
 * y se apaga a medida que se aleja. Sólo en escritorio y sin movimiento reducido.
 */
export default function ScrollFade({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!mq.matches) {
        el.style.opacity = "";
        return;
      }
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2);
      el.style.opacity = String(Math.max(0.25, Math.min(1, 1.35 - d)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    mq.addEventListener("change", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      mq.removeEventListener("change", onScroll);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
