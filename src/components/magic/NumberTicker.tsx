"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cuenta desde 0 hasta el número del texto ("10,6×", "+53%", "7,4 s") la primera vez que se ve.
 * Conserva el formato (coma decimal, prefijos y sufijos). Sin JS o con movimiento reducido, muestra el valor final.
 */
export default function NumberTicker({ value, className }: { value: string; className?: string }) {
  const m = value.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!m || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const [, pre, num, post] = m;
    const decimals = num.includes(",") || num.includes(".") ? num.split(/[.,]/)[1].length : 0;
    const sep = num.includes(",") ? "," : ".";
    const target = Number(num.replace(",", "."));
    const fmt = (n: number) => `${pre}${n.toFixed(decimals).replace(".", sep)}${post}`;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1400);
          setShown(fmt(target * (1 - Math.pow(1 - p, 4))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        setShown(fmt(0));
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
