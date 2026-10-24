"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginDialog from "@/components/auth/LoginDialog";
import { chargeTerms, firstChargeText, GUARANTEE_TEXT, NO_LOCK_IN_TEXT, PLAN_ORDER, PLANS, planDiscount, type Plan, type PlanId } from "@/lib/plans";
import { forgetReturnTo, readReturnTo } from "@/lib/billing/returnTo";
import SubscriptionManager, { type ManagedStatus } from "./SubscriptionManager";
import { trackCheckoutCreated, trackCheckoutFailed, trackPlanClick, trackVerifiedPurchase, type VerifiedPayment } from "@/lib/tracking";

type Status = ManagedStatus & { enabled: boolean; lastPayment?: VerifiedPayment | null };
/** El mensual en promo destacado, los otros planes en segundo plano y "Mi suscripción" de la cuenta. */
export default function BillingPanel() {
  const { email } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<PlanId | "cancel" | "status" | null>(null);
  const [login, setLogin] = useState(false);
  const [error, setError] = useState("");
  /** A qué botón corresponde el error: se muestra al lado, no al final del panel (si no, parecía que el clic no hacía nada). */
  const [errorFor, setErrorFor] = useState<PlanId | "cancel" | "status" | null>(null);
  /** Mercado Pago no acepta el email de Maru como pagador («different site»): se puede probar con el de otra cuenta de Mercado Pago Argentina. */
  const [payerAsk, setPayerAsk] = useState<PlanId | null>(null);
  const [payerEmail, setPayerEmail] = useState("");
  /** La herramienta donde el cupo frenó a la persona, para volver ahí cuando el pago queda confirmado. */
  const [back, setBack] = useState<{ path: string; label: string } | null>(null);
  useEffect(() => setBack(readReturnTo()), []);
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
  async function act(action: PlanId | "cancel" | "status", payer?: string) {
    if (!email) { setLogin(true); return; }
    // La baja de un pago iniciado sin terminar sigue acá; la de un plan activo, en "Mi suscripción".
    if (action === "cancel" && !window.confirm("¿Cancelar el pago iniciado? No se te cobra nada.")) return;
    setBusy(action); setError(""); setErrorFor(null);
    try {
      if (action === "status") await read(true);
      else {
        const checkout = action !== "cancel";
        if (checkout) trackPlanClick(action);
        const res = await fetch(`/api/billing/${checkout ? "checkout" : "cancel"}`, { method: "POST", headers: { "X-Maru-Account": email, "Content-Type": "application/json" }, body: checkout ? JSON.stringify({ plan: action, ...(payer ? { payerEmail: payer } : {}) }) : undefined }).catch(() => null);
        const body = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok) {
          if (checkout) trackCheckoutFailed(action, res ? body.code : "red");
          if (checkout && body.code === "PAYER_OTHER_SITE") setPayerAsk(action);
          throw new Error(body.error ?? "No pudimos completar el pedido.");
        }
        if (body.url) {
          // Inicio de checkout: el servidor ya creó la suscripción. Esperamos la etiqueta como mucho 0,8 s antes de ir a Mercado Pago.
          if (checkout && typeof body.checkoutId === "string") await trackCheckoutCreated(email, action, body.checkoutId, 800);
          window.location.assign(body.url);
        } else await read();
      }
    } catch (err) { setError(err instanceof Error ? err.message : "No pudimos completar el pedido."); setErrorFor(action); }
    finally { setBusy(null); }
  }
  const paid = status?.plan === "maru";
  const pending = !paid && (status?.status === "authorized" || status?.status === "pending");
  const [featured, ...others] = PLAN_ORDER.map((id) => PLANS[id]);
  const button = (plan: Plan, strong: boolean) => {
    const current = paid && status?.tier === plan.id;
    if (current) return <p className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-brand-soft px-4 text-center text-sm font-bold">Tu plan actual</p>;
    // Un pago iniciado y sin terminar del mismo plan se puede retomar (el servidor devuelve el mismo link de Mercado Pago).
    const resume = status?.status === "pending" && status.tier === plan.id;
    const blocked = (pending && !resume) || paid;
    return <>
      <button disabled={!!busy || !status?.enabled || blocked} onClick={() => void act(plan.id)} className={`press mt-5 min-h-12 w-full rounded-full px-6 py-3 font-bold uppercase disabled:cursor-default disabled:opacity-60 ${strong ? "bg-neon text-ink" : "border border-ink bg-white text-ink"}`}>
        {busy === plan.id ? "Un momento…" : !status ? "Consultando…" : !status.enabled ? "Próximamente" : resume ? "Retomar el pago" : "Elegir plan"}
      </button>
      {errorFor === plan.id && error && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {payerAsk === plan.id && <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (payerEmail.trim()) void act(plan.id, payerEmail.trim()); }}>
        <label className="sr-only" htmlFor={`payer-${plan.id}`}>Email de tu cuenta de Mercado Pago Argentina</label>
        <input id={`payer-${plan.id}`} type="email" required autoComplete="email" placeholder="Email de tu Mercado Pago Argentina" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} className="min-h-11 flex-1 rounded-full border border-line px-4 text-sm" />
        <button type="submit" disabled={!!busy} className="min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white disabled:opacity-50">{busy === plan.id ? "Un momento…" : "Pagar con este email"}</button>
      </form>}
      {blocked && !paid && status?.tier && <p className="mt-2 text-xs text-ink/70">Tenés un pago iniciado del plan {PLANS[status.tier].nombre.toLowerCase()}. Retomalo o cancelalo más abajo para elegir otro.</p>}
    </>;
  };
  const discount = planDiscount(featured);
  return <div>
    {paid && back && <div role="status" className="mx-auto mb-8 max-w-xl rounded-[24px] bg-brand-soft p-5 text-center sm:p-6">
      <p className="text-lg font-bold">Tu plan está activo.</p>
      <p className="mt-1 text-sm">Lo que habías cargado te espera donde lo dejaste.</p>
      <Link href={back.path} onClick={forgetReturnTo} className="press mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-neon px-6 py-3 font-bold uppercase text-ink">{back.label}</Link>
    </div>}
    {/* El mensual en promo, solo y destacado: precio de hoy, renovación, baja y garantía junto al botón. */}
    <article data-plan-card={featured.id} className="relative mx-auto max-w-xl rounded-[24px] border-2 border-ink bg-white p-6 pt-10 shadow-[0_12px_40px_rgba(0,0,0,0.08)] sm:p-8 sm:pt-12">
      {featured.badge && <p className="absolute inset-x-0 top-0 rounded-t-[22px] bg-neon py-1.5 text-center text-xs font-extrabold uppercase tracking-wider">{featured.badge}</p>}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-bold">{featured.nombre}</h3>
        {discount && <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-neon">-{discount}% el primer mes</span>}
      </div>
      <p className="mt-3 font-display text-5xl font-bold">{firstChargeText(featured)}<span className="ml-1 text-base font-medium">{featured.intro ? "el primer mes" : featured.per}</span></p>
      {featured.intro && <p className="mt-1 text-sm">Después, {featured.priceText} por mes <span className="text-ink/60">(precio regular)</span>.</p>}
      <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">{chargeTerms(featured)}</p>
      {button(featured, true)}
      <ul className="mt-4 space-y-1.5 text-sm">
        <li className="flex gap-2"><span aria-hidden className="font-bold text-brand">✓</span><span>{NO_LOCK_IN_TEXT}</span></li>
        <li className="flex gap-2"><span aria-hidden className="font-bold text-brand">✓</span><span><strong>Garantía de 14 días.</strong> {GUARANTEE_TEXT}</span></li>
      </ul>
      <p className="mt-3 text-sm"><Link href="/precios#como-cancelar" className="font-semibold underline underline-offset-4">Cómo cancelar</Link></p>
    </article>

    {/* Los otros planes, en segundo plano durante la promo. */}
    <p className="mt-8 text-center text-sm font-semibold text-ink/60">Otros planes</p>
    <div className="mx-auto mt-3 grid max-w-3xl gap-4 sm:grid-cols-2">
      {others.map((plan) => <article key={plan.id} data-plan-card={plan.id} className="rounded-[20px] border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">{plan.nombre}</h3>
          {plan.id === "trimestral" && <span className="rounded-full border border-ink px-2 py-0.5 text-[11px] font-semibold">Ahorrá 25%</span>}
        </div>
        <p className="mt-1 text-2xl font-bold">{plan.priceText}<span className="ml-1 text-sm font-medium">{plan.per}</span></p>
        <p className="text-xs text-ink/60">{plan.monthlyText} · {plan.note}</p>
        <p className="mt-2 text-xs text-ink/70">{chargeTerms(plan)}</p>
        {button(plan, false)}
      </article>)}
    </div>

    <div className="mx-auto mt-5 max-w-2xl text-center">
      {error && !(errorFor && errorFor in PLANS) && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {status && !status.enabled && <p className="rounded-2xl bg-sand p-4 text-sm leading-relaxed">Los planes todavía no están a la venta: hoy podés usar todas las herramientas gratis.</p>}
      {email && status && (paid || status.cancelRequest || status.refund || status.status === "authorized") && <div className="mt-4"><SubscriptionManager email={email} status={status} onChanged={() => read()} /></div>}
      {pending && status?.status === "pending" && <>
        <p className="text-sm">Tenés un pago iniciado sin terminar.</p>
        <button disabled={!!busy} onClick={() => void act("cancel")} className="mt-3 min-h-11 rounded-full border border-ink px-5 py-2 text-sm disabled:opacity-50">Cancelar pago pendiente</button>
      </>}
      {pending && status?.status === "authorized" && <p className="mt-3 text-sm">Estamos esperando que Mercado Pago confirme tu pago.</p>}
      {email && status?.enabled && <button disabled={!!busy} onClick={() => void act("status")} className="mt-2 block min-h-11 w-full rounded-full py-2 text-sm underline underline-offset-4 disabled:opacity-50">Actualizar estado de mi pago</button>}
      <p className="mt-3 text-xs leading-relaxed text-ink/70">Precios en pesos argentinos, con renovación automática por Mercado Pago. Al contratar aceptás los <Link href="/terminos" className="underline">términos</Link> y la <Link href="/privacidad" className="underline">política de privacidad</Link>. El acceso se confirma cuando Mercado Pago acredita el pago.</p>
    </div>
    <LoginDialog open={login} reason="contratar tu plan de Maru" onClose={() => setLogin(false)} onLoggedIn={() => { setLogin(false); void read(); }} />
  </div>;
}
