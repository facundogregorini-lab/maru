import Link from "next/link";
import LoginNotice from "./auth/LoginNotice";
import UserMenu from "./auth/UserMenu";
import MaruCompanion from "./maru/MaruCompanion";
import TrackerSync from "@/components/tracker/TrackerSync";
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

      <Link
        href="/extension"
        className="group flex items-center justify-center gap-2 bg-brand-soft px-4 py-2 text-center text-[13px] text-ink print:hidden"
      >
        <span aria-hidden>🧩</span>
        <span>
          Nuevo: la extensión de Maru completa tus postulaciones con un clic. <span className="font-semibold underline underline-offset-2">Descargala</span>
        </span>
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>

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
              className="press inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-[13px] font-bold uppercase text-white hover:bg-black sm:h-9 sm:px-5 sm:text-sm"
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

      <footer className="bg-sand print:hidden">
        <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-14 sm:px-8 lg:px-[120px]">
          <Link href="/" className="flex w-fit items-center gap-2" aria-label="Maru, ir al inicio">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-neon">
              <MaruHead size={24} />
            </span>
            <span className="font-display text-[30px] font-bold leading-none tracking-tight">Maru</span>
          </Link>
          <div className="mt-8 grid gap-8 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <FooterCol title="Herramientas" links={TOOLS} />
            <FooterCol title="Búsquedas populares" links={POPULAR.slice(0, 7)} />
            <FooterCol
              title="Maru"
              links={[
                { href: "/busquedas", label: "Todas las búsquedas" },
                { href: "/entrevista", label: "Entrevista con IA" },
                { href: "/#evidencia", label: "La evidencia" },
                { href: "/#faq", label: "Preguntas frecuentes" },
                { href: "/precios", label: "Precios" },
                { href: "/cuenta", label: "Mi cuenta" },
                { href: "/terminos", label: "Términos y condiciones" },
                { href: "/privacidad", label: "Privacidad" },
                { href: "/arrepentimiento", label: "Botón de arrepentimiento" },
              ]}
            />
            <div>
              <h3 className="text-sm font-semibold">Información</h3>
              <p className="mt-3 max-w-xs leading-relaxed text-ink/70">
                Tu coach de carrera con IA. Nunca inventa experiencia: reordena, reescribe y prioriza lo que ya hiciste. Revisá todo antes de enviar.
              </p>
            </div>
          </div>
        </div>
      </footer>

      <MaruCompanion />
      <TrackerSync />
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-1">
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
