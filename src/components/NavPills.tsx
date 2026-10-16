"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { NAV, TOOLS } from "./nav";

/**
 * Navegación de escritorio como la de jobright: una píldora con el selector negro
 * (Web / Extensión, el "Job seekers / Employers" de ellos) y al lado los links chicos.
 */
export function NavPills() {
  const path = usePathname();
  const ext = path.startsWith("/extension");
  const menu = useRef<HTMLDetailsElement>(null);

  // El menú se cierra al navegar o al hacer clic afuera.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [path]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const seg = (on: boolean) =>
    `flex h-8 w-[120px] items-center justify-center rounded-full text-sm font-semibold transition-colors ${on ? "bg-white text-ink ring-2 ring-inset ring-ink" : "text-white hover:text-neon"}`;

  return (
    <nav aria-label="Secciones" className="hidden items-center gap-6 rounded-full bg-white py-0.5 pl-0.5 pr-6 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] lg:flex">
      <div className="flex rounded-full bg-ink">
        <Link href="/" aria-current={!ext && path === "/" ? "page" : undefined} className={seg(!ext)}>
          Web
        </Link>
        <Link href="/extension" aria-current={ext ? "page" : undefined} className={seg(ext)}>
          Extensión
        </Link>
      </div>
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
      <Link href="/entrevista" aria-current={path === "/entrevista" ? "page" : undefined} className="text-[13px] hover:text-brand aria-[current=page]:font-semibold">
        Entrevista IA
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
