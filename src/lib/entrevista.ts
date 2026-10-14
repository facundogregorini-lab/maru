import type { EntrevistaOpciones, EntrevistaPlan, Intercambio } from "./schemas";

/** Límites para que el historial que manda el navegador no crezca sin control. */
export const MAX_RESPUESTA = 4000;
export const MAX_INTERCAMBIOS = 24;

export function clampHistorial(h: Intercambio[] | undefined): Intercambio[] {
  return (h ?? []).slice(0, MAX_INTERCAMBIOS).map((x) => ({
    pregunta: String(x.pregunta ?? "").slice(0, 800),
    respuesta: String(x.respuesta ?? "").slice(0, MAX_RESPUESTA),
    segundos: Number(x.segundos) || 0,
    repregunta: !!x.repregunta,
  }));
}

export function contextoEntrevista(plan: EntrevistaPlan, opciones?: Partial<EntrevistaOpciones>): string {
  return [
    `<entrevista>`,
    `Entrevistadora: ${plan.entrevistador.nombre} (${plan.entrevistador.cargo})`,
    `Puesto: ${plan.puesto}${plan.empresa ? ` en ${plan.empresa}` : ""}`,
    `Idioma: ${plan.idioma}`,
    opciones?.tipo ? `Tipo: ${opciones.tipo}` : "",
    opciones?.dificultad ? `Dificultad: ${opciones.dificultad}` : "",
    `Qué buscan: ${plan.contexto_puesto}`,
    `Candidato/a: ${plan.contexto_candidato}`,
    `</entrevista>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function historialTexto(h: Intercambio[]): string {
  return h
    .map((x, i) => `${i + 1}. ${x.repregunta ? "[Repregunta] " : ""}P: ${x.pregunta}\n   R (${Math.round(x.segundos)} s): ${x.respuesta || "(sin respuesta)"}`)
    .join("\n");
}
