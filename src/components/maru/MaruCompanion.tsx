"use client";

import { useEffect, useRef, useState } from "react";
import { MaruSprite } from "./PixelMaru";

/**
 * Maru en pixel art que acompaña a la persona por toda la pantalla: camina hacia el cursor
 * (o hacia donde se toca, en el celular), se da vuelta según la dirección, parpadea y saluda.
 * Nunca intercepta clics (pointer-events: none). Con movimiento reducido, se queda quieta en su rincón.
 */

const SIZE = 44; // ancho en px (alto proporcional)
const OFFSET = { x: 20, y: 16 }; // al costado del cursor, no encima
const GREETED_KEY = "maru:saludo";

export default function MaruCompanion() {
  const wrap = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<string | null>(null);

  useEffect(() => {
    const el = wrap.current;
    const sprite = el?.querySelector<SVGSVGElement>("svg");
    const body = el?.querySelector<HTMLDivElement>("[data-body]");
    if (!el || !sprite || !body) return;

    const height = (SIZE * 18) / 16;
    const corner = () => ({ x: window.innerWidth - SIZE - 24, y: window.innerHeight - height - 24 });
    let { x, y } = corner();
    let target = { x, y };
    let facing = 1;
    let raf = 0;
    let last = 0;
    let walkClock = 0;
    let walkA = true;
    let blinking = false;
    let waving = false;

    const setFrame = (f: string) => {
      if (sprite.dataset.frame !== f) sprite.dataset.frame = f;
    };
    const paint = () => {
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      // El globo de diálogo se abre hacia el lado con más espacio.
      el.dataset.side = x > window.innerWidth / 2 ? "left" : "right";
      body.style.transform = `scaleX(${facing})`;
    };
    paint();
    el.style.opacity = "1";

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Saludo: una vez por sesión.
    let greeted = false;
    try {
      greeted = sessionStorage.getItem(GREETED_KEY) === "1";
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      // sin sessionStorage: saluda igual
    }
    const timers: number[] = [];
    if (!greeted) {
      timers.push(
        window.setTimeout(() => {
          waving = true;
          setFrame("wave");
          setBubble("¡Hola! Soy Maru 👋");
        }, 900),
        window.setTimeout(() => {
          waving = false;
          setBubble(null);
          if (!raf) setFrame("idle");
        }, 4600),
      );
    }

    if (reduce) {
      return () => timers.forEach(clearTimeout);
    }

    const tick = (t: number) => {
      const dt = last ? Math.min(48, t - last) : 16;
      last = t;
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1.5) {
        // Acelera cuando está lejos y frena al llegar.
        const speed = Math.min(dist, Math.max(1.4, dist * 0.09) * (dt / 16));
        x += (dx / dist) * speed;
        y += (dy / dist) * speed;
        if (Math.abs(dx) > 2) facing = dx > 0 ? 1 : -1;
        walkClock += dt;
        if (walkClock > 130) {
          walkClock = 0;
          walkA = !walkA;
        }
        setFrame(walkA ? "walkA" : "walkB");
        paint();
        raf = requestAnimationFrame(tick);
      } else {
        x = target.x;
        y = target.y;
        paint();
        setFrame(waving ? "wave" : blinking ? "blink" : "idle");
        raf = 0;
        last = 0;
      }
    };
    const go = (px: number, py: number) => {
      target = {
        x: Math.max(8, Math.min(window.innerWidth - SIZE - 8, px)),
        y: Math.max(8, Math.min(window.innerHeight - height - 8, py)),
      };
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "mouse") go(e.clientX + OFFSET.x, e.clientY + OFFSET.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") go(e.clientX + OFFSET.x, e.clientY - height - 12);
    };
    // Si el mouse sale de la ventana, vuelve a su rincón.
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) {
        const c = corner();
        go(c.x, c.y);
      }
    };
    const onResize = () => go(target.x, target.y);

    const blink = window.setInterval(() => {
      if (raf || waving) return;
      blinking = true;
      setFrame("blink");
      window.setTimeout(() => {
        blinking = false;
        if (!raf && !waving) setFrame("idle");
      }, 140);
    }, 3200);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(blink);
      timers.forEach(clearTimeout);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={wrap}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50 opacity-0 transition-opacity duration-500 print:hidden"
      style={{ width: SIZE }}
    >
      {bubble && (
        <div className="maru-bubble animate-rise absolute bottom-full mb-2 whitespace-nowrap rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
          {bubble}
          <span className="maru-bubble-tail absolute top-full border-x-[6px] border-t-[6px] border-x-transparent border-t-ink" />
        </div>
      )}
      <div className="maru-scale">
        <div data-body className="origin-center">
          <MaruSprite size={SIZE} />
        </div>
        <div className="mx-auto -mt-1 h-1.5 w-8 rounded-full bg-black/15 blur-[1px]" />
      </div>
    </div>
  );
}
