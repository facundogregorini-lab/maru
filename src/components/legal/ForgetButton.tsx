"use client";

import { useState } from "react";
import { forgetEverything } from "@/lib/match/clientStore";

/** Borra todo lo que Maru guardó en este navegador. */
export default function ForgetButton() {
  const [done, setDone] = useState(false);
  if (done) return <p className="font-semibold text-brand-dark">Listo: borramos tus datos de este navegador.</p>;
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("¿Borrar todos tus datos de Maru en este navegador? Perfil, preferencias, búsquedas, lo que armaste y tu seguimiento.")) return;
        forgetEverything();
        setDone(true);
      }}
      className="press mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black"
    >
      Borrar mis datos de este navegador
    </button>
  );
}
