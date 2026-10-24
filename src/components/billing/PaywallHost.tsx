"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { syncLocalMilestones, trackPaywallViewed, trackVerifiedPurchase } from "@/lib/tracking";
import { rememberReturnTo } from "@/lib/billing/returnTo";
import { PLAN_FEATURE_EVENT, PLAN_LIMIT_EVENT, type LimitedTool, type PlanFeature } from "@/lib/tracking/paywall";
import BillingPanel from "./BillingPanel";

const TOOL_TEXT: Record<LimitedTool, string> = {
  cv: "tu CV gratis de hoy",
  carta: "tu carta gratis de hoy",
  entrevista: "tu práctica de entrevista gratis de esta semana",
  video: "tu guion de video gratis de esta semana",
};

const FEATURE_TEXT: Record<PlanFeature, { title: string; text: string }> = {
  keywords: {
    title: "Cubrir las palabras clave es parte de los planes",
    text: "Con un plan, Maru propone una frase para cada palabra clave que falta, en la experiencia que mejor la respalda, y vos decidís cuáles sumar.",
  },
};

/**
 * Planes en pantalla cuando el cupo gratis frena una acción (429 PLAN_LIMIT, ver src/lib/tracking/paywall.ts).
 * Cada aviso del servidor es una exposición nueva; volver a renderizar no cuenta. La conversión de Ads
 * ("Maru | Límite alcanzado") sale sólo la primera vez por cuenta y recién cuando los planes están visibles.
 * También concilia, una vez por sesión del navegador, una compra verificada que no se haya medido en /precios.
 */
export default function PaywallHost() {
  const { email } = useAuth();
  const emailRef = useRef(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [exposure, setExposure] = useState<{ n: number; tool: LimitedTool } | null>(null);
  /** Función del plan pago que la persona tocó: mismo modal, con su texto, sin medir la conversión de límite. */
  const [feature, setFeature] = useState<PlanFeature | null>(null);

  useEffect(() => {
    const onLimit = (e: Event) => {
      const tool = (e as CustomEvent<{ tool?: LimitedTool }>).detail?.tool;
      if (!tool || !(tool in TOOL_TEXT)) return;
      // Mercado Pago vuelve a /precios: guardamos la herramienta para ofrecer volver cuando se confirme el pago.
      rememberReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      setFeature(null);
      setExposure((prev) => ({ n: (prev?.n ?? 0) + 1, tool }));
    };
    const onFeature = (e: Event) => {
      const f = (e as CustomEvent<{ feature?: PlanFeature }>).detail?.feature;
      if (!f || !(f in FEATURE_TEXT)) return;
      rememberReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      setExposure(null);
      setFeature(f);
      if (dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
    };
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    window.addEventListener(PLAN_FEATURE_EVENT, onFeature);
    return () => {
      window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
      window.removeEventListener(PLAN_FEATURE_EVENT, onFeature);
    };
  }, []);

  // Abrir y medir: una sola vez por exposición, después de que el navegador pintó las tarjetas de planes.
  useEffect(() => {
    if (!exposure) return;
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const visible = d.open && document.visibilityState === "visible" && !!d.querySelector("[data-plan-card]");
        if (visible) void trackPaywallViewed(emailRef.current, exposure.tool);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [exposure]);

  // Con sesión: hitos ya enviados desde este navegador quedan en la cuenta, y una compra verificada pendiente de medir se mide.
  useEffect(() => {
    if (!email) return;
    void syncLocalMilestones(email);
    try {
      if (sessionStorage.getItem("maru:billing:checked") === email) return;
      sessionStorage.setItem("maru:billing:checked", email);
    } catch { /* sin almacenamiento: se consulta igual */ }
    fetch("/api/billing/status", { cache: "no-store", headers: { "X-Maru-Account": email } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s?.lastPayment) void trackVerifiedPurchase(email, s.lastPayment); })
      .catch(() => {});
  }, [email]);

  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => e.target === dialogRef.current && close()}
      className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[1000px] overflow-y-auto rounded-[28px] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="paywall-title"
    >
      {(exposure || feature) && (
        <div className="p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="paywall-title" className="font-display text-2xl font-bold sm:text-3xl">{feature ? FEATURE_TEXT[feature].title : "Llegaste al límite gratis"}</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink/70">
                {feature ? FEATURE_TEXT[feature].text : `Ya usaste ${exposure ? TOOL_TEXT[exposure.tool] : ""}. Con un plan de Maru seguís sin esperar.`}
              </p>
            </div>
            <button type="button" onClick={close} aria-label="Cerrar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink">
              ✕
            </button>
          </div>
          <div className="mt-6">
            <BillingPanel />
          </div>
          <p className="mt-4 text-center text-sm">
            <Link href="/precios" onClick={close} className="font-semibold underline underline-offset-4">
              Ver todo lo que incluyen los planes
            </Link>
          </p>
        </div>
      )}
    </dialog>
  );
}
