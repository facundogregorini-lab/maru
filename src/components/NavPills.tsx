"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";


/** Navegación en una píldora (como el selector de jobright); la página actual va en negro. */
export function NavPills() {
  const path = usePathname();
  return (
    <nav aria-label="Secciones" className="hidden items-center rounded-full border border-ink/80 p-0.5 lg:flex">
      {NAV.map((n) => {
        const on = path === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${on ? "bg-ink text-white" : "text-ink hover:bg-black/[0.05]"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Menú compacto para celular y tablet. */
export function NavMenu() {
  const path = usePathname();
  return (
    <details className="group relative lg:hidden">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full bg-black/[0.04] [&::-webkit-details-marker]:hidden" aria-label="Menú">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M3 6h14M3 10h14M3 14h14" />
        </svg>
      </summary>
      <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)] ring-1 ring-line">
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
