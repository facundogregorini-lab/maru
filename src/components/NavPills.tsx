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
    <nav aria-label="Secciones" className="hidden items-center gap-6 rounded-full bg-white px-6 py-3 ring-1 ring-line lg:flex">
      <details ref={menu} className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] hover:text-brand [&::-webkit-details-marker]:hidden">
          Herramientas
          <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden className="transition-transform group-open:rotate-180">
            <path d="M1 3h8L5 8z" fill="currentColor" />
          </svg>
        </summary>
        <div className="absolute left-1/2 top-9 z-50 w-72 -translate-x-1/2 rounded-2xl bg-white p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] ring-1 ring-line">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className="block rounded-xl px-3 py-2.5 hover:bg-sand aria-[current=page]:bg-sand">
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-xs text-muted">{t.hint}</span>
            </Link>
          ))}
        </div>
      </details>
      <Link href="/busquedas" aria-current={path === "/busquedas" ? "page" : undefined} className="text-[13px] hover:text-brand aria-[current=page]:font-semibold">
        Búsquedas
      </Link>
      <Link href="/precios" aria-current={path === "/precios" ? "page" : undefined} className="text-[13px] hover:text-brand aria-[current=page]:font-semibold">
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
    <details ref={menu} className="group relative lg:hidden">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full [&::-webkit-details-marker]:hidden" aria-label="Menú">
        <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </summary>
      <div className="absolute left-0 top-11 z-50 w-60 rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] ring-1 ring-line">
        <Link href="/" className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${path === "/" ? "bg-sand" : "hover:bg-black/[0.04]"}`}>
          Inicio
        </Link>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={path === n.href ? "page" : undefined}
            className={`block rounded-xl px-3 py-2.5 text-sm font-medium ${path === n.href ? "bg-sand text-ink" : "hover:bg-black/[0.04]"}`}
          >
            {n.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
