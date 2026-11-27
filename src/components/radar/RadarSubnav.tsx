"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const RADAR_TABS = [
  { href: "/radar/empresas", label: "Mis empresas" },
  { href: "/radar/oportunidades", label: "Oportunidades" },
  { href: "/radar/descubrimiento", label: "Descubrimiento" },
  { href: "/radar/automatizacion", label: "Automatización" },
] as const;

/** Subnav de Radar: en celular se desplaza de costado. */
export default function RadarSubnav() {
  const path = usePathname();
  return (
    <nav aria-label="Secciones de Radar laboral" className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-full bg-white p-1 ring-1 ring-black/[0.06]">
        {RADAR_TABS.map((t) => {
          const on = path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink ${on ? "bg-ink text-white" : "hover:bg-surface"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
