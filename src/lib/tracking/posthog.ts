/**
 * Funnels de producto en PostHog (navegador). Sólo eventos con nombre y valores de una lista cerrada, como
 * Vercel Analytics: sin autocaptura de clics y sin identificar a la persona (nunca viaja el email). Graba las
 * sesiones (session replay) con los campos de formulario enmascarados. Las visitas y los eventos de un mismo navegador forman el funnel.
 *
 * Sólo se activa con NEXT_PUBLIC_POSTHOG_KEY y en los dominios de producción (los mismos de Google Ads):
 * localhost y los previews de Vercel no ensucian los datos. Ver docs/TRACKING.md.
 */
import posthog from "posthog-js";
import { isAdsHost } from "./config";

type Props = Record<string, string | number | boolean>;

/** Secciones de Maru: cada una tiene su funnel en PostHog (`seccion_vista` → resultado → activación). */
export const SECCIONES = ["postulacion", "cv", "carta", "video", "entrevista", "match", "busquedas", "seguimiento", "extension", "precios"] as const;
export type Seccion = (typeof SECCIONES)[number];

export function seccionDe(pathname: string): Seccion | null {
  const first = pathname.split("/")[1] ?? "";
  return (SECCIONES as readonly string[]).includes(first) ? (first as Seccion) : null;
}

/** El resultado principal de cada herramienta: la primera respuesta de la IA que la persona ve. */
const RESULTADOS: Record<string, string> = {
  "/api/generate": "postulacion",
  "/api/cv/generate": "cv",
  "/api/carta": "carta",
  "/api/video/guion": "video",
  "/api/entrevista/preparar": "entrevista",
  "/api/match/ranking": "match",
};
export const herramientaDeResultado = (url: string): string | null => RESULTADOS[url] ?? null;

let started = false;

export function initPostHog(): boolean {
  if (started) return true;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (typeof window === "undefined" || !key || !isAdsHost(window.location.hostname)) return false;
  try {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
      capture_pageview: false, // la manda PostHogPageviews, antes de `seccion_vista`, para que el orden del funnel sea fijo
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: false,
      session_recording: { maskAllInputs: true }, // lo que se escribe en formularios no se graba
      disable_surveys: true,
      person_profiles: "identified_only",
    });
    started = true;
  } catch {
    // la medición nunca rompe la app
  }
  return started;
}

/** Evento para PostHog. Agrega la sección donde pasó; no hace nada si PostHog no está activo. */
export function capture(event: string, props: Props = {}): void {
  if (!started) return;
  try {
    const seccion = seccionDe(window.location.pathname);
    posthog.capture(event, seccion ? { seccion, ...props } : props);
  } catch {
    // la medición nunca rompe la app
  }
}

/** Visita (`$pageview`) y, si es una sección de Maru, `seccion_vista`. */
export function capturePageview(): void {
  if (!started) return;
  capture("$pageview");
  if (seccionDe(window.location.pathname)) capture("seccion_vista");
}
