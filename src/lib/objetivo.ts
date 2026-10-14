import type { Objetivo } from "./schemas";

export const PAISES: readonly (readonly [string, string])[] = [
  ["AR", "Argentina"],
  ["UY", "Uruguay"],
  ["CL", "Chile"],
  ["MX", "México"],
  ["CO", "Colombia"],
  ["PE", "Perú"],
  ["BR", "Brasil"],
  ["ES", "España"],
  ["IT", "Italia"],
  ["US", "Estados Unidos"],
  ["GB", "Reino Unido"],
  ["", "Remoto / varios países"],
];

export const NIVELES = ["", "Junior", "Semi senior", "Senior", "Líder de equipo", "Gerencia", "Dirección / C-level"] as const;

export const INDUSTRIAS = [
  "Tecnología / startups",
  "Corporativo",
  "Finanzas y banca",
  "Consumo masivo / retail",
  "Salud",
  "Consultoría",
  "Diseño / creativo",
  "Educación",
  "Sector público / ONG",
  "Industria / energía",
] as const;

export const IDIOMAS: readonly (readonly ["es" | "en" | "pt", string])[] = [
  ["es", "Español"],
  ["en", "Inglés"],
  ["pt", "Portugués"],
];

export function objetivoBlock(o: Objetivo, notas: string) {
  const pais = PAISES.find(([c]) => c === o.pais)?.[1] ?? (o.pais || "Remoto / varios países");
  return {
    type: "text" as const,
    text: [
      "<objetivo>",
      `Rol buscado: ${o.rol.trim() || "(no lo indicó: deducilo de su trayectoria)"}`,
      `Nivel: ${o.nivel || "(no indicado)"}`,
      `Industria / tipo de empresa: ${o.industria || "(no indicada)"}`,
      `Mercado donde busca: ${pais}${o.pais ? ` (${o.pais})` : ""}`,
      `Idioma del CV: ${o.idioma}`,
      "</objetivo>",
      `<notas_de_la_persona>\n${notas.trim() || "(sin notas)"}\n</notas_de_la_persona>`,
    ].join("\n"),
  };
}
