/** Listas populares de búsquedas (chips de la home y columna del footer). Llevan a /busquedas con filtros. */
export const POPULAR = [
  { label: "Desarrollo de software remoto", href: "/busquedas?area=software&modalidad=remoto" },
  { label: "Ventas", href: "/busquedas?area=ventas" },
  { label: "Datos y analytics", href: "/busquedas?area=datos" },
  { label: "Producto", href: "/busquedas?area=producto" },
  { label: "Marketing", href: "/busquedas?area=marketing" },
  { label: "Diseño", href: "/busquedas?area=diseno" },
  { label: "Recursos humanos", href: "/busquedas?area=rrhh" },
  { label: "Atención al cliente", href: "/busquedas?area=atencion_cliente" },
  { label: "Finanzas", href: "/busquedas?area=finanzas" },
  { label: "Pasantías", href: "/busquedas?nivel=pasantia" },
  { label: "Junior", href: "/busquedas?nivel=junior" },
] as const;
