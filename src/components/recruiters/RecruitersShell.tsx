import Link from "next/link";
import UserMenu from "@/components/auth/UserMenu";
import { MaruHead } from "@/components/maru/PixelMaru";

/** Marco de Maru Recruiters: barra superior propia (no la de quien busca trabajo). */
export default function RecruitersShell({ children, crumb }: { children: React.ReactNode; crumb?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-3">
      <a href="#contenido" className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-black/5 bg-white px-3 sm:px-6">
        <Link href="/recruiters" className="flex items-center gap-2" aria-label="Maru Recruiters, inicio">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-neon">
            <MaruHead size={22} />
          </span>
          <span className="font-display text-xl">maru</span>
          <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-[#0b4a2a]">Recruiters</span>
        </Link>
        {crumb && <div className="hidden min-w-0 truncate text-sm text-muted md:block">{crumb}</div>}
        <div className="ml-auto flex items-center gap-2">
          <UserMenu />
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-[1280px] px-3 pb-24 pt-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
