import Link from "next/link";
import LoginNotice from "./auth/LoginNotice";
import UserMenu from "./auth/UserMenu";
import MaruCompanion from "./maru/MaruCompanion";
import { MaruHead } from "./maru/PixelMaru";
import { NAV } from "./nav";
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

      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/85 backdrop-blur-lg print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2" aria-label="Maru Coach, ir al inicio">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft">
              <MaruHead size={26} />
            </span>
            <span className="font-display text-[22px] font-bold tracking-tight">Maru</span>
          </Link>
          <NavPills />
          <div className="flex min-w-0 items-center gap-2">
            <UserMenu />
            <Link
              href="/match"
              className="press hidden rounded-full bg-ink px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-black sm:inline-flex"
            >
              Empezar ahora
            </Link>
            <NavMenu />
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-7xl px-5 pb-28 pt-8">
        <LoginNotice />
        {children}
      </main>

      <footer className="border-t border-line bg-white print:hidden">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft">
                <MaruHead size={26} />
              </span>
              <span className="font-display text-2xl font-bold tracking-tight">Maru</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Tu coach de carrera con IA. Nunca inventa experiencia: reordena, reescribe y prioriza lo que ya hiciste. Revisá todo antes de enviar.
            </p>
          </div>
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wide">Herramientas</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="hover:text-ink">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wide">Maru</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/#evidencia" className="hover:text-ink">
                  La evidencia
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-ink">
                  Preguntas frecuentes
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      <MaruCompanion />
    </div>
  );
}
