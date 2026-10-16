"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { forgetEverything } from "@/lib/match/clientStore";

/** Borra todo lo que Maru guardó en este navegador y, con sesión, también lo de la cuenta (la sincronización sube el borrado). */
export default function ForgetButton() {
  const { email } = useAuth();
  const [done, setDone] = useState(false);
  const where = email ? "de este navegador y de tu cuenta" : "de este navegador";
  if (done) return <p className="font-semibold text-brand-dark">Listo: borramos tus datos {where}.</p>;
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm(`¿Borrar todos tus datos de Maru ${where}? Perfil, preferencias, búsquedas, lo que armaste y tu seguimiento.`)) return;
        forgetEverything();
        setDone(true);
      }}
      className="press mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black"
    >
      Borrar mis datos {email ? "de este navegador y de mi cuenta" : "de este navegador"}
    </button>
  );
}
