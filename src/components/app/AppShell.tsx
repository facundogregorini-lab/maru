import Link from "next/link";
import LoginNotice from "@/components/auth/LoginNotice";
import UserMenu from "@/components/auth/UserMenu";
import MaruCompanion from "@/components/maru/MaruCompanion";
import { MaruHead } from "@/components/maru/PixelMaru";
import { NavMenu } from "@/components/NavPills";
import SideNav from "./SideNav";

/**
 * La "app" de jobright (Jobs, Resume, Profile…): barra lateral de íconos, barra superior con el
 * título de la sección y un buscador, la lista en el centro y un panel a la derecha.
 */
export default function AppShell({
  title,
  search,
  side,
  children,
}: {
  title: string;
  search?: React.ReactNode;
  side?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f6f7] lg:pl-[72px]">
      <a href="#contenido" className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Saltar al contenido
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center gap-2 bg-[linear-gradient(90deg,#e4e5e8,#f8fafe)] py-4 lg:flex" aria-label="Herramientas">
        <Link href="/" aria-label="Maru, ir al inicio" className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-neon">
          <MaruHead size={26} />
        </Link>
        <SideNav />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-black/5 bg-white px-3 sm:px-4">
        <span className="lg:hidden">
          <NavMenu />
        </span>
        <Link href="/" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon lg:hidden" aria-label="Maru, ir al inicio">
          <MaruHead size={20} />
        </Link>
        <p className="truncate text-lg font-extrabold uppercase sm:text-[22px]">{title}</p>
        <div className="ml-auto hidden min-w-0 flex-1 justify-end md:flex">{search}</div>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-4">
          <span className="hidden sm:block">
            <UserMenu />
          </span>
          <Link href="/match" className="press inline-flex h-8 items-center rounded-full bg-ink px-4 text-[13px] font-extrabold uppercase text-white hover:bg-black sm:h-9 sm:px-5 sm:text-[15px]">
            Mi match
          </Link>
        </div>
      </header>

      <div className="flex">
        <main id="contenido" className="min-w-0 flex-1 px-3 pb-24 pt-4 sm:px-4">
          <LoginNotice />
          {search && <div className="mb-3 md:hidden">{search}</div>}
          {children}
        </main>
        {side && <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[348px] shrink-0 overflow-y-auto bg-white p-4 xl:block">{side}</aside>}
      </div>
      <MaruCompanion />
    </div>
  );
}
