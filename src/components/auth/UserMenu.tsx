"use client";

import { useAuth } from "./AuthProvider";

export default function UserMenu() {
  const { email, logout } = useAuth();
  if (!email) return <span className="hidden text-sm text-muted sm:block">Tu postulación, a medida</span>;
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <span className="hidden truncate text-muted sm:inline" title={email}>
        {email}
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-soft font-medium text-sage sm:hidden" aria-label={email}>
        {email[0]?.toUpperCase()}
      </span>
      <button type="button" onClick={logout} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-clay hover:text-clay">
        Salir
      </button>
    </div>
  );
}
