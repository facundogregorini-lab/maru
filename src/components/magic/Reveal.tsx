"use client";

import { useEffect, useRef } from "react";

/**
 * Hace aparecer a sus hijos marcados con data-reveal cuando entran en pantalla, en orden
 * (cada uno con su --i). Sin JavaScript o con movimiento reducido, todo se ve desde el principio.
 */
export default function Reveal({ children, className, as: Tag = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "section" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = root.matches("[data-reveal]") ? [root] : [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}
