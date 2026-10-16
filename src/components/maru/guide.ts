/**
 * El recorrido de Maru por los productos: breve, cálido y verdadero (sólo lo que Maru hace hoy).
 * Cada paso es un ítem del checklist; se tilda al pasarlo o al visitar su página.
 */

export type GuideStep = { id: string; href: string; emoji: string; title: string; text: string; cta: string };

export const GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: "busquedas",
    href: "/busquedas",
    emoji: "🔎",
    title: "Búsquedas reales",
    text: "Miles de búsquedas abiertas, revisadas todos los días. Te marco cuáles podés tomar desde Argentina.",
    cta: "Ver búsquedas",
  },
  {
    id: "match",
    href: "/match",
    emoji: "🎯",
    title: "Tu match",
    text: "Subís tu CV y te ordeno las búsquedas por cuánto encajan con vos, con el porqué de cada una.",
    cta: "Ver mi match",
  },
  {
    id: "postulacion",
    href: "/postulacion",
    emoji: "✍️",
    title: "CV a medida",
    text: "Pegás el link del aviso y reescribo tu CV con lo que busca esa empresa. También las respuestas del formulario.",
    cta: "Adaptar mi CV",
  },
  {
    id: "cv",
    href: "/cv",
    emoji: "📄",
    title: "Tu CV, de cero o mejorado",
    text: "Sin una búsqueda puntual: armamos un CV prolijo y listo para los filtros automáticos.",
    cta: "Armar mi CV",
  },
  {
    id: "carta",
    href: "/carta",
    emoji: "💌",
    title: "Carta de presentación",
    text: "Una carta con tus logros y en tu tono. Si un párrafo no te convence, lo reescribo.",
    cta: "Escribir mi carta",
  },
  {
    id: "extension",
    href: "/extension",
    emoji: "⚡",
    title: "Extensión para Chrome",
    text: "Completo los formularios de postulación por vos. Vos revisás y enviás, siempre.",
    cta: "Ver la extensión",
  },
  {
    id: "entrevista",
    href: "/entrevista",
    emoji: "🎙️",
    title: "Entrevista de práctica",
    text: "Te entrevisto por voz, repregunto como en una de verdad y te dejo un informe con puntaje.",
    cta: "Practicar",
  },
  {
    id: "video",
    href: "/video",
    emoji: "🎬",
    title: "Video de presentación",
    text: "Te escribo el guion, lo leés en un teleprompter y te digo cómo salió cada toma.",
    cta: "Grabar mi video",
  },
  {
    id: "seguimiento",
    href: "/seguimiento",
    emoji: "📋",
    title: "Seguimiento",
    text: "Todas tus postulaciones en un tablero, con lo que armamos para cada una. Nada se te pasa.",
    cta: "Ver mi tablero",
  },
];

/** La oferta del final del recorrido: el plan trimestral, expresado por mes ($22.500 / 3) y por día (/ 90). */
export const PLAN_PRICE_TEXT = "$7.500";
export const PLAN_PER_DAY_TEXT = "$250";

export const GUIDE_KEY = "maru:guia:v1";

export type GuideState = {
  /** nueva: todavía no se la ofrecimos · rechazada: "ahora no" · abierta: en curso · cerrada: la cerró a mitad · terminada. */
  status: "nueva" | "rechazada" | "abierta" | "cerrada" | "terminada";
  step: number;
  /** Abierta pero achicada (se fue a probar un producto). */
  min: boolean;
  done: string[];
};

export const NEW_GUIDE: GuideState = { status: "nueva", step: 0, min: false, done: [] };
