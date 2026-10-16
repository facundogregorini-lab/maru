"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import LoginDialog from "./LoginDialog";

/** Header: "Ingresar" sin sesión; email y "Salir" con sesión. */
export default function UserMenu() {
  const { email, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (email === undefined) return <span className="h-8 w-20" aria-hidden />;

  if (!email) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press rounded-full bg-black/[0.04] px-4 py-2 text-[13px] font-medium uppercase tracking-wide hover:bg-black/[0.08]"
        >
          Ingresar
        </button>
        <LoginDialog open={open} reason="entrar a Maru" onClose={() => setOpen(false)} onLoggedIn={() => setOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="hidden max-w-[220px] truncate text-muted sm:inline" title={email}>
        {email}
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-soft font-medium text-sage sm:hidden" aria-label={email}>
        {email[0]?.toUpperCase()}
      </span>
      <button type="button" onClick={logout} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand">
        Salir
      </button>
    </div>
  );
}
