/** Secciones del sitio (header, menú y footer). Va aparte: los componentes de servidor no pueden importar datos de un módulo "use client". */
export const NAV = [
  { href: "/match", label: "Match" },
  { href: "/postulacion", label: "Postulación" },
  { href: "/cv", label: "CV" },
  { href: "/carta", label: "Carta" },
  { href: "/video", label: "Video" },
  { href: "/entrevista", label: "Entrevista" },
  { href: "/extension", label: "Extensión" },
] as const;
