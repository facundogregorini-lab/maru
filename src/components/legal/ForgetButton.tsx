"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { forgetAccountData } from "@/lib/sync/client";
import { forgetEverything } from "@/lib/match/clientStore";

/** Borra todo lo que Maru guardó en este navegador y, con sesión, también lo de la cuenta (la sincronización sube el borrado). */
export default function ForgetButton() {
  const { email } = useAuth();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const where = email ? "de este navegador y de tu cuenta" : "de este navegador";
  if (done) return <p className="font-semibold text-brand-dark">Listo: borramos tus datos {where}.</p>;
  return (
    <><button
      disabled={busy}
      type="button"
      onClick={async () => {
        if (!window.confirm(`¿Borrar todos tus datos de Maru ${where}? Perfil, preferencias, búsquedas, lo que armaste y tu seguimiento.`)) return;
        setBusy(true); setError("");
        forgetEverything();
        try { if (email) await forgetAccountData(); setDone(true); }
        catch (err) { setError(err instanceof Error ? err.message : "No pudimos confirmar el borrado."); }
        finally { setBusy(false); }
      }}
      className="press mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black"
    >
      {busy ? "Borrando…" : "Borrar mis datos"} {email ? "de este navegador y de mi cuenta" : "de este navegador"}
    </button>{error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}</>
  );
}
