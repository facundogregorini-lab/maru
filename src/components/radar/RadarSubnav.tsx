"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { trackRadar } from "@/lib/radar/analytics";

export const RADAR_TABS = [
  { href: "/radar/empresas", label: "Mis empresas" },
  { href: "/radar/oportunidades", label: "Oportunidades" },
  { href: "/radar/descubrimiento", label: "Descubrimiento" },
  { href: "/radar/automatizacion", label: "Automatización" },
] as const;

/** Subnav de Radar: en celular se desplaza de costado. */
export default function RadarSubnav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    trackRadar("radar_viewed", { screen: path.split("/")[2] ?? "empresas" });
    fetch("/api/radar/avisos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { unread: 0 }))
      .then((d: { unread?: number }) => setUnread(d.unread ?? 0))
      .catch(() => {});
  }, [path]);
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
                {t.href === "/radar/oportunidades" && unread > 0 && (
                  <span className="ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-neon px-1 text-xs font-bold text-ink">
                    {unread}
                    <span className="sr-only"> avisos sin leer</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
