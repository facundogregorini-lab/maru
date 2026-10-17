"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginDialog from "@/components/auth/LoginDialog";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { trackCheckoutCreated, trackCheckoutFailed, trackPlanClick, trackVerifiedPurchase, type VerifiedPayment } from "@/lib/tracking";

type Status = { enabled: boolean; plan: string; tier: PlanId | null; status: string; paidThrough: number | null; lastPayment?: VerifiedPayment | null };
/** Las tres tarjetas de planes pagos y el estado de la suscripción de la cuenta. */
export default function BillingPanel() {
  const { email } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<PlanId | "cancel" | "status" | null>(null);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState("");
  const read = useCallback(async (refresh = false) => {
    const res = await fetch("/api/billing/status", { method: refresh ? "POST" : "GET", cache: "no-store", headers: email ? { "X-Maru-Account": email } : {} });
    const body = await res.json();
    if (!res.ok) throw new Error(`${body.error ?? "No pudimos consultar tu plan."}${body.detail ? ` Detalle: ${body.detail}` : ""}`);
    setStatus(body);
    // Compra: sólo con el pago verificado por el servidor; una vez por pago (ver src/lib/tracking).
    void trackVerifiedPurchase(email, body.lastPayment);
  }, [email]);
  useEffect(() => {
    let active = true;
    setStatus(null);
    fetch("/api/billing/status", { cache: "no-store", headers: email ? { "X-Maru-Account": email } : {} }).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      if (active) setStatus(body);
      if (active) void trackVerifiedPurchase(email, body.lastPayment);
    }).catch(() => { if (active) setError("No pudimos consultar tu plan. Recargá la página para reintentar."); });
    return () => { active = false; };
  }, [email]);
  async function act(action: PlanId | "cancel" | "status") {
    if (!email) { setLogin(true); return; }
    if (action === "cancel" && !window.confirm("¿Cancelar la renovación de tu plan? Conservás el acceso hasta que termine el período pagado.")) return;
    setBusy(action); setError("");
    try {
      if (action === "status") await read(true);
      else {
        const checkout = action !== "cancel";
        if (checkout) trackPlanClick(action);
        const res = await fetch(`/api/billing/${checkout ? "checkout" : "cancel"}`, { method: "POST", headers: { "X-Maru-Account": email, "Content-Type": "application/json" }, body: checkout ? JSON.stringify({ plan: action }) : undefined }).catch(() => null);
        const body = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok) {
          if (checkout) trackCheckoutFailed(action, res ? body.code : "red");
          throw new Error(body.error ?? "No pudimos completar el pedido.");
        }
        if (body.url) {
          // Inicio de checkout: el servidor ya creó la suscripción. Esperamos la etiqueta como mucho 0,8 s antes de ir a Mercado Pago.
          if (checkout && typeof body.checkoutId === "string") await trackCheckoutCreated(email, action, body.checkoutId, 800);
          window.location.assign(body.url);
        } else await read();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "No pudimos completar el pedido."); }
    finally { setBusy(null); }
  }
  const paid = status?.plan === "maru";
  const pending = !paid && (status?.status === "authorized" || status?.status === "pending");
  return <div>
    <div className="grid gap-5 md:grid-cols-3 md:items-end">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const current = paid && status?.tier === id;
        return <article key={id} data-plan-card={id} className={`relative rounded-[24px] bg-white p-6 ${plan.badge ? "order-first border-2 border-ink md:order-none pt-10 shadow-[0_12px_40px_rgba(0,0,0,0.08)] md:pb-8" : "border border-line"}`}>
          {plan.badge && <p className="absolute inset-x-0 top-0 rounded-t-[22px] bg-neon py-1.5 text-center text-xs font-extrabold uppercase tracking-wider">{plan.badge}</p>}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">{plan.nombre}</h3>
            {plan.id === "trimestral" && <span className="rounded-full border border-ink px-2.5 py-0.5 text-xs font-semibold">Ahorrá 25%</span>}
          </div>
          <p className="mt-3 text-sm text-ink/60">{plan.monthlyText}</p>
          <p className="mt-1 font-display text-4xl font-bold">{plan.priceText}<span className="ml-1 text-base font-medium">{plan.per}</span></p>
          <p className="mt-2 text-sm text-ink/70">{plan.note}</p>
          {current ? <p className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-brand-soft px-4 text-center text-sm font-bold">Tu plan actual</p>
            : <button disabled={!!busy || !status?.enabled || pending || paid} onClick={() => void act(id)} className={`press mt-5 min-h-12 w-full rounded-full px-6 py-3 font-bold uppercase disabled:cursor-default disabled:opacity-60 ${plan.badge ? "bg-neon text-ink" : "bg-ink text-white"}`}>
              {busy === id ? "Un momento…" : !status ? "Consultando…" : !status.enabled ? "Próximamente" : "Elegir plan"}
            </button>}
        </article>;
      })}
    </div>
    <div className="mx-auto mt-5 max-w-2xl text-center">
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {paid && <>
        <p className="font-semibold">Tu plan {status.tier ? PLANS[status.tier].nombre.toLowerCase() : ""} está activo hasta el {status.paidThrough && new Date(status.paidThrough).toLocaleDateString("es-AR")}.</p>
        {status.status === "cancelled" ? <p className="mt-2 text-sm">La renovación está cancelada.</p> : <button disabled={!!busy} onClick={() => void act("cancel")} className="mt-3 min-h-11 rounded-full border border-ink px-5 py-2 text-sm font-semibold disabled:opacity-50">Cancelar renovación</button>}
      </>}
      {status && !status.enabled && <p className="rounded-2xl bg-sand p-4 text-sm leading-relaxed">Los planes todavía no están a la venta: hoy podés usar todas las herramientas gratis.</p>}
      {pending && <>
        <p className="text-sm">{status?.status === "authorized" ? "Estamos esperando que Mercado Pago confirme tu pago." : "Tenés un pago iniciado sin terminar."}</p>
        <button disabled={!!busy} onClick={() => void act("cancel")} className="mt-3 min-h-11 rounded-full border border-ink px-5 py-2 text-sm disabled:opacity-50">Cancelar suscripción pendiente</button>
      </>}
      {email && status?.enabled && <button disabled={!!busy} onClick={() => void act("status")} className="mt-2 block min-h-11 w-full rounded-full py-2 text-sm underline underline-offset-4 disabled:opacity-50">Actualizar estado de mi pago</button>}
      <p className="mt-3 text-xs leading-relaxed text-ink/70">Precios en pesos argentinos, con renovación automática por Mercado Pago. Al contratar aceptás los <Link href="/terminos" className="underline">términos</Link> y la <Link href="/privacidad" className="underline">política de privacidad</Link>. El acceso se confirma cuando Mercado Pago acredita el pago.</p>
    </div>
    <LoginDialog open={login} reason="contratar tu plan de Maru" onClose={() => setLogin(false)} onLoggedIn={() => { setLogin(false); void read(); }} />
  </div>;
}
