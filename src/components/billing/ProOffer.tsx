"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { rememberReturnTo } from "@/lib/billing/returnTo";
import { requestFirstDownloadOffer, trackOfferClick, trackOfferSkipped, trackOfferViewed, type OfferExposure, type OfferResult, type OfferSkipReason } from "@/lib/tracking/offer";
import BillingPanel from "./BillingPanel";

/** Textos por entregable. El primer bloque confirma que el resultado es gratis; el segundo, qué suma un plan. */
export const OFFER_TEXT: Record<OfferResult, { title: string; subtitle: string; body: string }> = {
  cv: {
    title: "¡Tu CV personalizado está listo!",
    subtitle: "Podés descargarlo gratis ahora mismo.",
    body: "Con Maru Pro podés preparar más postulaciones, personalizar tus CVs para distintas ofertas y aprovechar todas las herramientas incluidas en tu plan.",
  },
  carta: {
    title: "¡Tu carta de presentación está lista!",
    subtitle: "Podés descargarla gratis ahora mismo.",
    body: "Con Maru Pro podés escribir una carta distinta para cada búsqueda, preparar más postulaciones y aprovechar todas las herramientas incluidas en tu plan.",
  },
};
export const FREE_NOTE = "Tu descarga gratuita está disponible. No necesitás pagar.";

type Step = "oferta" | "planes";
/** Clics sobre el fondo que llegan tan rápido después de abrir son el segundo clic de «Descargar», no un cierre. */
const BACKDROP_GRACE_MS = 600;

/**
 * Oferta anticipada de Maru Pro antes de la primera descarga gratis.
 *
 *   const offer = useProOffer();
 *   offer.guard("cv", () => download());   // muestra la oferta si corresponde y, al cerrarla, descarga
 *   return <>{offer.dialog}…</>;
 *
 * No es un límite: cualquier forma de cerrarla (botón gratis, ✕, Escape, clic afuera, «Por ahora, descargar gratis»)
 * sigue con la descarga pedida. Si el servidor no responde a tiempo o falla, descarga directo.
 */
export function useProOffer() {
  const { email, refresh } = useAuth();
  const emailRef = useRef(email);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);
  const [open, setOpen] = useState<{ exp: OfferExposure; step: Step } | null>(null);
  const [checking, setChecking] = useState(false);
  const busy = useRef(false);
  const proceedRef = useRef<(() => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** Un doble clic en «Descargar» no debe cerrar la oferta apenas aparece: el segundo clic cae sobre el fondo. */
  const openedAt = useRef(0);

  const guard = useCallback(
    async (tipo: OfferResult, proceed: () => void) => {
      // Doble clic mientras se consulta o con la oferta abierta: no abre otra ni dispara otra descarga.
      if (busy.current) return;
      busy.current = true;
      setChecking(true);
      let exp: OfferExposure | null = null;
      try {
        // Recién ingresado, el contexto puede no tener el email todavía.
        const who = emailRef.current ?? (await refresh().catch(() => null));
        exp = await requestFirstDownloadOffer(who, tipo);
      } catch {
        exp = null;
      } finally {
        setChecking(false);
      }
      if (!exp) {
        busy.current = false;
        proceed();
        return;
      }
      proceedRef.current = proceed;
      setOpen({ exp, step: "oferta" });
    },
    [refresh],
  );

  /** Cierra la oferta y sigue con la descarga. Idempotente: un segundo cierre no descarga dos veces. */
  const finish = useCallback(
    (motivo: OfferSkipReason) => {
      const proceed = proceedRef.current;
      if (!proceed || !open) return;
      proceedRef.current = null;
      trackOfferSkipped(open.exp, motivo);
      const d = dialogRef.current;
      if (d?.open) d.close();
      setOpen(null);
      busy.current = false;
      proceed();
    },
    [open],
  );

  const showPlans = useCallback(() => {
    if (!open) return;
    trackOfferClick(open.exp);
    // Si paga, Mercado Pago vuelve a /precios y desde ahí ofrecemos volver a este resultado (ya guardado).
    rememberReturnTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    setOpen({ ...open, step: "planes" });
  }, [open]);

  // Abrir y medir la vista una sola vez, cuando la oferta ya está pintada y la pestaña visible.
  // `open` cambia sólo al abrir o cambiar de paso: volver a renderizar no vuelve a medir (trackOfferViewed también deduplica).
  useEffect(() => {
    if (!open || open.step !== "oferta") return;
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) {
      d.showModal();
      openedAt.current = Date.now();
      // El foco va a la acción principal; Escape, ✕ y el botón gratis quedan a un tab.
      d.querySelector<HTMLElement>("[data-offer-primary]")?.focus();
    }
    const exp = open.exp;
    const authenticated = !!emailRef.current;
    let raf = 0;
    const measure = () => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => {
          if (d.open && document.visibilityState === "visible" && d.querySelector("[data-offer-card]")) trackOfferViewed(exp, authenticated);
        });
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") measure();
    };
    measure();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open]);

  const step = open?.step;
  const dismissReason = (base: OfferSkipReason): OfferSkipReason => (step === "planes" ? "planes_cerrar" : base);
  const text = open ? OFFER_TEXT[open.exp.tipo] : null;

  const dialog = (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        // Escape: cerramos nosotros para seguir con la descarga.
        e.preventDefault();
        finish(dismissReason("escape"));
      }}
      onClick={(e) => {
        if (e.target !== dialogRef.current || Date.now() - openedAt.current < BACKDROP_GRACE_MS) return;
        finish(dismissReason("click_fuera"));
      }}
      aria-labelledby="oferta-pro-title"
      aria-describedby="oferta-pro-desc"
      className={`m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-y-auto rounded-[28px] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] ${step === "planes" ? "max-w-[1000px]" : "max-w-[480px]"}`}
    >
      {open && text && step === "oferta" && (
        <div data-offer-card className="relative p-5 sm:p-7">
          <button
            type="button"
            onClick={() => finish("cerrar_modal")}
            aria-label="Cerrar y descargar gratis"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
          >
            ✕
          </button>
          <div className="flex items-center gap-3 pr-8">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neon text-lg font-bold text-ink">✓</span>
            <h2 id="oferta-pro-title" className="font-display text-xl font-bold leading-tight sm:text-2xl">{text.title}</h2>
          </div>
          <p className="mt-2 text-ink/70">{text.subtitle}</p>

          <hr className="my-5 border-line" />

          <div id="oferta-pro-desc">
            <p className="text-lg font-bold leading-snug">
              <span className="mr-2 inline-block rounded-full bg-ink px-2 py-0.5 align-[0.15em] text-[11px] font-extrabold uppercase leading-normal tracking-wider text-neon">Pro</span>
              ¿Querés acelerar tu búsqueda laboral?
            </p>
            <p className="mt-2 leading-relaxed text-ink/80">{text.body}</p>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button type="button" data-offer-primary onClick={showPlans} className="press min-h-12 w-full rounded-full bg-neon px-6 py-3 font-bold text-ink">
              Conocer Maru Pro →
            </button>
            <button type="button" onClick={() => finish("descarga_gratis")} className="press min-h-12 w-full rounded-full border border-ink bg-white px-6 py-3 font-semibold text-ink">
              Continuar con mi descarga gratis
            </button>
          </div>
          <p className="mt-3 text-center text-sm text-ink/70">{FREE_NOTE}</p>
        </div>
      )}

      {open && step === "planes" && (
        <div className="p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="oferta-pro-title" className="font-display text-2xl font-bold sm:text-3xl">Elegí tu plan de Maru Pro</h2>
              <p id="oferta-pro-desc" className="mt-2 max-w-2xl leading-relaxed text-ink/70">{open.exp.tipo === "cv" ? "Tu CV sigue listo: podés descargarlo gratis cuando quieras." : "Tu carta sigue lista: podés descargarla gratis cuando quieras."}</p>
            </div>
            <button
              type="button"
              onClick={() => finish("planes_descarga_gratis")}
              className="press min-h-11 shrink-0 rounded-full border border-ink bg-white px-5 py-2 text-sm font-semibold text-ink"
            >
              Por ahora, descargar gratis
            </button>
          </div>
          <div className="mt-6">
            <BillingPanel origen="primera_descarga" />
          </div>
          <p className="mt-6 text-center">
            <button type="button" onClick={() => finish("planes_descarga_gratis")} className="min-h-11 text-sm font-semibold underline underline-offset-4">
              Por ahora, descargar gratis
            </button>
          </p>
        </div>
      )}
    </dialog>
  );

  return { guard, dialog, checking };
}
