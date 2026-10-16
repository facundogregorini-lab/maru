"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Íconos de la barra lateral (los de jobright: Jobs, Resume, Profile, Agent, Coaching, Interview). */
const ITEMS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/busquedas", label: "Búsquedas", icon: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" /> },
  {
    href: "/match",
    label: "Match",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.8" />
      </>
    ),
  },
  { href: "/cv", label: "CV", icon: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" /> },
  { href: "/postulacion", label: "Postular", icon: <path d="m4 12 16-8-6 16-3-6zM11 14l9-10" /> },
  { href: "/carta", label: "Carta", icon: <path d="M3 6h18v12H3zM3 7l9 6 9-6" /> },
  { href: "/entrevista", label: "Entrevista", icon: <path d="M5 5h14v10H10l-5 4zM9 9h6M9 12h4" /> },
  { href: "/video", label: "Video", icon: <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3" /> },
  { href: "/extension", label: "Extensión", icon: <path d="M9 4h4v3a2 2 0 1 0 0 4v0h4v4h-3a2 2 0 1 0 0 4H9v-4a2 2 0 1 1 0-4V7H5V4h4" /> },
];

export default function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const on = path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${on ? "bg-white shadow-sm" : "hover:bg-white/70"}`}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {it.icon}
            </svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
