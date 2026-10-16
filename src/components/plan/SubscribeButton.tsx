"use client";

import { useState } from "react";
import { useLoginGate } from "@/components/auth/useLoginGate";
import { post } from "@/components/ui";

/** "Quiero el plan": pide ingresar si hace falta y lleva al pago de Mercado Pago. */
export default function SubscribeButton({ className, children = "Quiero el plan Maru" }: { className: string; children?: React.ReactNode }) {
  const gate = useLoginGate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setError("");
    setBusy(true);
    try {
      const { url } = await post<{ url: string }>("/api/pagos/suscribir", {});
      window.location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => gate.run("activar tu plan", go)} disabled={busy} className={className}>
        {busy ? "Abriendo Mercado Pago…" : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-xs text-brand-dark">
          {error}
        </p>
      )}
      {gate.dialog}
    </>
  );
}
