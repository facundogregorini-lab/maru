"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/radar/empresas", label: "Mis empresas" },
  { href: "/radar/oportunidades", label: "Oportunidades" },
  { href: "/radar/descubrimiento", label: "Descubrimiento" },
  { href: "/radar/automatizacion", label: "Automatización" },
] as const;

export default function RadarTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Radar laboral" className="-mx-3 mb-5 overflow-x-auto border-b border-[#dce0e3] px-3 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-6">
        {TABS.map((t) => {
          const on = path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-[3px] text-sm font-semibold ${on ? "border-neon text-ink" : "border-transparent text-muted hover:text-ink"}`}
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
