/**
 * Eventos propios del flujo de match. Maru todavía no tiene analytics instalado, así que esto es un
 * punto único y seguro: si en el futuro se agrega Vercel Analytics (window.va) o similar, los eventos
 * salen por ahí. Nunca se envían datos personales: sólo nombre del evento y valores agregados.
 * No toca píxeles ni eventos de conversión existentes.
 */

export type MatchEvent =
  | "match_inicio"
  | "match_cv_listo"
  | "match_perfil_confirmado"
  | "match_preferencias_listas"
  | "match_ranking_visto"
  | "match_guardar"
  | "match_descartar"
  | "match_ver_busqueda"
  | "match_preparar_postulacion"
  | "match_busqueda_externa"
  | "match_datos_borrados";

type Props = Record<string, string | number | boolean>;

const ALLOWED_KEYS = new Set(["resultados", "pendientes", "motivo", "fuente", "posicion", "familia", "confianza", "filtros"]);

export function track(event: MatchEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const safe = Object.fromEntries(Object.entries(props).filter(([k]) => ALLOWED_KEYS.has(k)));
  try {
    const va = (window as unknown as { va?: (t: "event", d: { name: string; data?: Props }) => void }).va;
    va?.("event", { name: event, data: safe });
    window.dispatchEvent(new CustomEvent("maru:event", { detail: { event, ...safe } }));
  } catch {
    // los eventos nunca rompen la app
  }
}
