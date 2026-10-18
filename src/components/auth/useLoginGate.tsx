"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import LoginDialog from "./LoginDialog";

type Action = (justLoggedIn: boolean) => void | Promise<void>;

/**
 * Exige haber ingresado antes de una acción (descargar, copiar…).
 * Con sesión, corre la acción; sin sesión, abre el diálogo de ingreso y la retoma apenas ingresa.
 *
 *   const gate = useLoginGate();
 *   gate.run("descargar tu CV", () => download());
 *   return <>{gate.dialog}…</>;
 */
export function useLoginGate() {
  const { email } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const pending = useRef<{ action: Action; resume: boolean } | null>(null);

  const ask = useCallback((why: string, action: Action, resume = true) => {
    pending.current = { action, resume };
    setReason(why);
  }, []);

  const run = useCallback(
    (why: string, action: Action, opts: { resume?: boolean } = {}) => {
      if (email) return void action(false);
      ask(why, action, opts.resume ?? true);
    },
    [email, ask],
  );

  const onLoggedIn = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    setReason(null);
    // Algunas acciones (copiar al portapapeles) necesitan un toque nuevo: el navegador lo exige.
    if (p?.resume) setTimeout(() => void p.action(true), 0);
  }, []);

  const dialog = (
    <LoginDialog
      open={reason !== null}
      reason={reason ?? ""}
      onClose={() => {
        pending.current = null;
        setReason(null);
      }}
      onLoggedIn={onLoggedIn}
    />
  );

  return { email, run, ask, dialog };
}
