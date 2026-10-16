"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import LoginDialog from "./LoginDialog";

/** Header: "Ingresar" sin sesión; email y "Salir" con sesión. */
export default function UserMenu() {
  const { email, paid, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (email === undefined) return <span className="h-8 w-20" aria-hidden />;

  if (!email) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press h-9 rounded-full px-1 text-[13px] font-medium uppercase hover:bg-black/[0.08] sm:w-[120px] sm:bg-black/[0.04] sm:px-0 sm:text-sm"
        >
          Ingresar
        </button>
        <LoginDialog open={open} reason="entrar a Maru" onClose={() => setOpen(false)} onLoggedIn={() => setOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <Link href="/cuenta" className="hidden max-w-[220px] items-center gap-1.5 truncate text-muted hover:text-ink sm:inline-flex" title={`${email} · Mi cuenta`}>
        {paid && <span className="rounded bg-neon px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">Plan Maru</span>}
        <span className="truncate">{email}</span>
      </Link>
      <Link href="/cuenta" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-soft font-medium text-sage sm:hidden" aria-label={`Mi cuenta (${email})`}>
        {email[0]?.toUpperCase()}
      </Link>
      <button type="button" onClick={logout} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand">
        Salir
      </button>
    </div>
  );
}
