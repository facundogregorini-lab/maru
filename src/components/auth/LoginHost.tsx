"use client";

import { useEffect, useRef, useState } from "react";
import { setLoginHandler } from "@/lib/loginRequest";
import LoginDialog from "./LoginDialog";

/** Diálogo de ingreso para las herramientas: lo abre `post()` cuando el servidor pide ingresar (ver src/lib/loginRequest.ts). */
export default function LoginHost() {
  const [reason, setReason] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(
    () =>
      setLoginHandler(
        (why) =>
          new Promise<boolean>((resolve) => {
            resolver.current = resolve;
            setReason(why);
          }),
      ),
    [],
  );

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setReason(null);
  };

  return <LoginDialog open={reason !== null} reason={reason ?? ""} onClose={() => finish(false)} onLoggedIn={() => finish(true)} />;
}
