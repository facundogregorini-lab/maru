/** Secciones del sitio (header, menú y footer). Va aparte: los componentes de servidor no pueden importar datos de un módulo "use client". */
export const NAV = [
  { href: "/precios", label: "Planes" },
  { href: "/match", label: "Match" },
  { href: "/busquedas", label: "Búsquedas" },
  { href: "/postulacion", label: "Postulación" },
  { href: "/cv", label: "CV" },
  { href: "/carta", label: "Carta" },
  { href: "/video", label: "Video" },
  { href: "/entrevista", label: "Entrevista" },
  { href: "/seguimiento", label: "Seguimiento" },
  { href: "/extension", label: "Extensión" },
] as const;

/** Menú "Herramientas ▾" del header (el "Features ▾" de jobright). */
export const TOOLS = [
  { href: "/match", label: "Match con IA", hint: "Las búsquedas que encajan con tu CV" },
  { href: "/postulacion", label: "Postulación a medida", hint: "CV, respuestas y carta para un aviso" },
  { href: "/cv", label: "CV con IA", hint: "Armá o mejorá tu CV" },
  { href: "/carta", label: "Carta de presentación", hint: "A medida de cada búsqueda" },
  { href: "/entrevista", label: "Práctica de entrevista", hint: "Preguntas y repreguntas para tu rol" },
  { href: "/video", label: "Video de presentación", hint: "Guion, teleprompter y feedback" },
  { href: "/seguimiento", label: "Seguimiento", hint: "Tus postulaciones en un tablero" },
  { href: "/extension", label: "Extensión para Chrome", hint: "Autocompletá postulaciones" },
] as const;
