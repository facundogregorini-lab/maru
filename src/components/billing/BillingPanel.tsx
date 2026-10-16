"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginDialog from "@/components/auth/LoginDialog";

type Status = { enabled: boolean; plan: string; status: string; paidThrough: number | null };
export default function BillingPanel() {
  const { email } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState("");
  const read = useCallback(async (refresh = false) => {
    const res = await fetch("/api/billing/status", { method: refresh ? "POST" : "GET", cache: "no-store", headers: email ? { "X-Maru-Account": email } : {} });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "No pudimos consultar tu plan.");
    setStatus(body);
  }, [email]);
  useEffect(() => {
    let active = true;
    setStatus(null);
    fetch("/api/billing/status", { cache: "no-store", headers: email ? { "X-Maru-Account": email } : {} }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      if (active) setStatus(body);
    }).catch(() => { if (active) setError("No pudimos consultar tu plan. Recargá la página para reintentar."); });
    return () => { active = false; };
  }, [email]);
  async function act(action: "checkout" | "cancel" | "status") {
    if (!email) { setLogin(true); return; }
    if (action === "cancel" && !window.confirm("¿Cancelar la renovación de tu plan? Conservás el acceso hasta que termine el período pagado.")) return;
    setBusy(true); setError("");
    try {
      if (action === "status") await read(true);
      else {
        const res = await fetch(`/api/billing/${action}`, { method: "POST", headers: { "X-Maru-Account": email } });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (body.url) window.location.assign(body.url);
        else await read();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "No pudimos completar el pedido."); }
    finally { setBusy(false); }
  }
  const paid = status?.plan === "maru";
  const pending = status?.status === "authorized" && !paid;
  return <div className="mt-6">
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {paid ? <>
      <p className="font-semibold">Tu plan está activo hasta el {status.paidThrough && new Date(status.paidThrough).toLocaleDateString("es-AR")}.</p>
      {status.status === "cancelled" ? <p className="mt-2 text-sm">La renovación está cancelada.</p> : <button disabled={busy} onClick={() => void act("cancel")} className="mt-4 min-h-11 rounded-full border border-ink px-5 py-2 text-sm font-semibold disabled:opacity-50">Cancelar renovación</button>}
    </> : <>
      <button disabled={busy || !status?.enabled || pending} onClick={() => void act("checkout")} className="press min-h-12 w-full rounded-full bg-neon px-6 py-3 font-bold uppercase text-ink disabled:cursor-default disabled:opacity-60">
        {busy ? "Un momento…" : !status ? "Consultando…" : !status.enabled ? "Disponible próximamente" : pending ? "Esperando confirmación del pago" : "Elegir el plan Maru"}
      </button>
      {!status?.enabled && status && <p className="mt-3 text-sm leading-relaxed text-ink/70">Mientras preparamos la suscripción, podés seguir usando las herramientas gratis, sin tarjeta.</p>}
    </>}
    {!paid && (status?.status === "authorized" || status?.status === "pending") && <button disabled={busy} onClick={() => void act("cancel")} className="mt-3 min-h-11 w-full rounded-full border border-ink px-4 py-2 text-sm disabled:opacity-50">Cancelar suscripción pendiente</button>}
    {email && status?.enabled && <button disabled={busy} onClick={() => void act("status")} className="mt-3 min-h-11 w-full rounded-full py-2 text-sm underline underline-offset-4 disabled:opacity-50">Actualizar estado de mi pago</button>}
    <p className="mt-4 text-xs leading-relaxed text-ink/70">Al contratar aceptás los <Link href="/terminos" className="underline">términos</Link> y la <Link href="/privacidad" className="underline">política de privacidad</Link>. El acceso se confirma cuando Mercado Pago acredita el pago.</p>
    <LoginDialog open={login} reason="contratar tu plan de Maru" onClose={() => setLogin(false)} onLoggedIn={() => { setLogin(false); void read(); }} />
  </div>;
}
