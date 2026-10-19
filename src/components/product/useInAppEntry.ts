"use client";

import { useLayoutEffect, useState } from "react";
import { peekHandoff, type Handoff, type HandoffTarget } from "@/lib/match/clientStore";

/**
 * ¿Se llegó a la herramienta desde otra pantalla de Maru (Match, Búsquedas, Seguimiento u otra herramienta)?
 * Esos accesos traen la búsqueda ya cargada o apuntan a #empezar: ahí la presentación comercial sobra y se
 * va directo al formulario. Quien entra desde afuera (o Google) sigue viendo la landing completa.
 * Corre antes de pintar, así no se ve la landing un instante; tiene que mirar antes de que el flujo tome la búsqueda.
 */
export function useInAppEntry(target?: HandoffTarget): { inApp: boolean; job: Handoff | null } {
  const [state, setState] = useState<{ inApp: boolean; job: Handoff | null }>({ inApp: false, job: null });
  useLayoutEffect(() => {
    const job = target ? peekHandoff(target) : null;
    if (job || window.location.hash === "#empezar") setState({ inApp: true, job });
  }, [target]);
  return state;
}

/** El título de "Empezá ahora" cuando la búsqueda ya vino cargada: "Tu postulación para Data Analyst". */
export function entryHeading(entry: { inApp: boolean; job: Handoff | null }, lead: string, base: { title?: string; hint?: string } = {}) {
  if (!entry.inApp) return base;
  const job = entry.job;
  if (!job?.title) return { ...base, compact: true };
  return { title: `${lead} ${job.title}`, hint: `${job.company ? `${job.company} · ` : ""}Ya cargamos la vacante: completá lo que falta y empezá.`, compact: true };
}
