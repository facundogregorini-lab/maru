import Link from "next/link";
import LoginNotice from "./auth/LoginNotice";
import UserMenu from "./auth/UserMenu";

/** Header y footer compartidos por la home y cada sección. */
export default function SiteShell({ tagline, children }: { tagline?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-sm text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b border-line/60 bg-cream/75 backdrop-blur-xl backdrop-saturate-150 print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Maru Coach, ir al inicio">
            <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-ink font-serif text-lg italic text-paper transition-transform duration-300 group-hover:rotate-[-6deg]">
              <span aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(88,196,211,0.55),transparent_60%)]" />
              <span className="relative">m</span>
            </span>
            <span className="text-[17px] font-semibold tracking-tight">
              maru <span className="font-serif text-xl font-normal italic text-celeste">coach</span>
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-5">
            {tagline && <span className="hidden text-sm text-muted md:block">{tagline}</span>}
            <UserMenu />
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-5 pb-28 pt-8">
        <LoginNotice />
        {children}
      </main>
      <footer className="border-t border-line/70 print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold tracking-tight text-ink">
            maru <span className="font-serif text-base font-normal italic text-celeste">coach</span>
          </span>
          <p className="max-w-xl sm:text-right">Maru nunca inventa experiencia: reordena, reescribe y prioriza lo que ya hiciste. Revisá todo antes de enviar.</p>
        </div>
      </footer>
    </div>
  );
}
