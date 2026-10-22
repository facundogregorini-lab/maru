"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginDialog from "@/components/auth/LoginDialog";
import SubscriptionManager, { type ManagedStatus } from "./SubscriptionManager";

/**
 * Botón de baja y botón de arrepentimiento: piden ingresar con la cuenta que pagó (verificación de identidad)
 * y llevan a la misma acción de "Mi suscripción", con el número de solicitud en pantalla.
 */
export default function SelfService({ mode }: { mode: "baja" | "devolucion" }) {
  const { email } = useAuth();
  const [login, setLogin] = useState(false);
  const [status, setStatus] = useState<ManagedStatus | null>(null);
  const [error, setError] = useState("");

  const read = useCallback(async () => {
    if (!email) return;
    const res = await fetch("/api/billing/status", { cache: "no-store", headers: { "X-Maru-Account": email } }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !body) { setError("No pudimos consultar tu suscripción. Recargá la página para reintentar."); return; }
    setError("");
    setStatus(body);
  }, [email]);
  useEffect(() => { void read(); }, [read]);

  if (email === undefined) return null;
  if (!email)
    return <div className="mt-6 rounded-2xl bg-sand p-5">
      <p>Para {mode === "baja" ? "cancelar" : "arrepentirte de"} tu suscripción, ingresá con la cuenta con la que pagaste. Así confirmamos que sos vos.</p>
      <button type="button" onClick={() => setLogin(true)} className="press mt-4 min-h-11 rounded-full bg-ink px-6 py-2 font-bold text-white">Ingresar para continuar</button>
      <LoginDialog open={login} reason={mode === "baja" ? "cancelar tu suscripción" : "pedir la devolución"} onClose={() => setLogin(false)} onLoggedIn={() => setLogin(false)} />
    </div>;
  if (error) return <p role="alert" className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  if (!status) return <p className="mt-6 text-sm text-ink/60">Consultando tu suscripción…</p>;
  const hasSubscription = status.plan === "maru" || status.status !== "none" || status.cancelRequest || status.refund;
  if (!hasSubscription) return <p className="mt-6 rounded-2xl bg-sand p-5">No encontramos una suscripción en la cuenta {email}. Si pagaste con otra cuenta, salí e ingresá con esa.</p>;
  return <div className="mt-6"><SubscriptionManager email={email} status={status} onChanged={read} focus={mode} /></div>;
}
