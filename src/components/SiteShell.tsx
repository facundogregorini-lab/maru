import Link from "next/link";
import LoginNotice from "./auth/LoginNotice";
import UserMenu from "./auth/UserMenu";

/** Header y footer compartidos por la home y cada sección. */
export default function SiteShell({ tagline, children }: { tagline?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-6 print:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="Maru, ir al inicio">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-clay font-serif text-lg text-paper">m</span>
          <span className="font-serif text-2xl tracking-tight">maru</span>
        </Link>
        <div className="flex min-w-0 items-center gap-5">
          {tagline && <span className="hidden text-sm text-muted md:block">{tagline}</span>}
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24">
        <LoginNotice />
        {children}
      </main>
      <footer className="border-t border-line py-8 text-center text-xs text-muted print:hidden">
        Maru nunca inventa experiencia: reordena, reescribe y prioriza lo que ya hiciste. Revisá todo antes de enviar.
      </footer>
    </div>
  );
}
