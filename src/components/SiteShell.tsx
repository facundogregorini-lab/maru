import Link from "next/link";
import LoginNotice from "./auth/LoginNotice";
import UserMenu from "./auth/UserMenu";
import MaruCompanion from "./maru/MaruCompanion";
import { MaruHead } from "./maru/PixelMaru";
import { POPULAR } from "@/lib/popular";
import { TOOLS } from "./nav";
import { NavMenu, NavPills } from "./NavPills";

/** Header, footer y Maru (que acompaña en todas las páginas). `tagline` queda por compatibilidad. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SiteShell({ tagline, children }: { tagline?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a href="#contenido" className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 bg-white print:hidden">
        <div className="mx-auto flex h-[64px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-8 lg:px-20">
          <div className="flex items-center gap-1">
            <NavMenu />
            <Link href="/" className="flex items-center gap-2" aria-label="Maru, ir al inicio">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-neon">
                <MaruHead size={24} />
              </span>
              <span className="font-display text-[26px] font-bold leading-none tracking-tight">Maru</span>
            </Link>
          </div>
          <NavPills />
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <UserMenu />
            <Link
              href="/match"
              className="press inline-flex h-7 items-center rounded-2xl bg-ink px-3.5 text-sm font-bold uppercase text-white sm:h-9 sm:min-w-[120px] sm:justify-center sm:rounded-[22px] sm:px-5"
            >
              <span className="sm:hidden">Empezar</span>
              <span className="hidden sm:inline">Empezar ahora</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-[1240px] px-5 pb-28 pt-8">
        <LoginNotice />
        {children}
      </main>

      <footer className="bg-hero print:hidden">
        <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-14 sm:px-8 lg:px-[120px]">
          <Link href="/" className="flex w-fit items-center gap-2" aria-label="Maru, ir al inicio">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-neon">
              <MaruHead size={24} />
            </span>
            <span className="font-display text-[30px] font-bold leading-none tracking-tight">Maru</span>
          </Link>
          <div className="mt-10 grid gap-8 text-[13px] leading-4 sm:grid-cols-2 lg:grid-cols-4">
            <FooterCol title="Herramientas" links={TOOLS} />
            <FooterCol title="Búsquedas populares" links={POPULAR.slice(0, 7)} />
            <FooterCol
              title="Maru"
              links={[
                { href: "/busquedas", label: "Todas las búsquedas" },
                { href: "/entrevista", label: "Entrevista con IA" },
                { href: "/#como-funciona", label: "Cómo funciona" },
                { href: "/#faq", label: "Preguntas frecuentes" },
                { href: "/precios", label: "Planes y precios" },
                { href: "/terminos", label: "Términos y condiciones" },
                { href: "/privacidad", label: "Privacidad" },
              ]}
            />
            <div>
              <h3 className="text-sm font-semibold">Información</h3>
              <p className="mt-3 max-w-xs leading-relaxed text-ink/70">
                Tu coach de carrera con IA. Prepará tus postulaciones con tu experiencia real. Revisá los textos y confirmá los datos antes de enviar.
              </p>
            </div>
          </div>
        </div>
      </footer>

      <MaruCompanion />
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-base font-semibold sm:text-sm">{title}</h3>
      <ul className="mt-4 space-y-2">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
