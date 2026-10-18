"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV, TOOLS } from "./nav";

/** La extensión es una herramienta más; no cambia el modo de uso del sitio. */
export function NavPills() {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);

  // El menú se cierra al navegar, al hacer clic afuera o con Escape.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <nav aria-label="Secciones" className="hidden h-11 items-center gap-6 rounded-[60px] bg-white px-6 shadow-[var(--shadow-nav)] lg:flex">
      <details ref={menu} className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] leading-4 hover:opacity-70 [&::-webkit-details-marker]:hidden">
          Herramientas
          <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden className="transition-transform group-open:rotate-180">
            <path d="M1 3h8L5 8z" fill="currentColor" />
          </svg>
        </summary>
        <div className="absolute left-1/2 top-9 z-50 w-72 -translate-x-1/2 rounded-2xl bg-white p-2 shadow-[var(--shadow-card)]">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className="block rounded-xl px-3 py-2.5 hover:bg-surface aria-[current=page]:bg-surface">
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-xs text-muted">{t.hint}</span>
            </Link>
          ))}
        </div>
      </details>
      <Link href="/busquedas" aria-current={path === "/busquedas" ? "page" : undefined} className="text-[13px] leading-4 hover:opacity-70 aria-[current=page]:font-semibold">
        Búsquedas
      </Link>
      <Link href="/precios" aria-current={path === "/precios" ? "page" : undefined} className="text-[13px] leading-4 hover:opacity-70 aria-[current=page]:font-semibold">
        Planes
      </Link>
    </nav>
  );
}

/** Menú de celular y tablet: hamburguesa a la izquierda, como en jobright. */
export function NavMenu() {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);
  return (
    <details ref={menu} className="group lg:hidden">
      <summary className="relative z-[60] grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full [&::-webkit-details-marker]:hidden" aria-label="Menú">
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="group-open:hidden">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="hidden group-open:block">
          <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
        </svg>
      </summary>
      {/* Pantalla completa debajo del header, como en jobright: links grandes y un divisor. */}
      <div className="fixed inset-x-0 bottom-0 top-[64px] z-50 overflow-y-auto bg-white px-4 pb-10 pt-4 sm:top-[76px] sm:px-8">
        <nav aria-label="Secciones">
          <Link href="/" className={`flex h-10 items-center text-base ${path === "/" ? "font-semibold" : ""}`}>
            Inicio
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined} className="flex h-10 items-center text-base aria-[current=page]:font-semibold">
              {n.label}
            </Link>
          ))}
        </nav>
        <hr className="my-4 border-surface" />
        <Link href="/#faq" className="flex h-10 items-center text-base">
          Preguntas frecuentes
        </Link>
        <Link href="/privacidad" className="flex h-10 items-center text-base">
          Privacidad
        </Link>
      </div>
    </details>
  );
}
