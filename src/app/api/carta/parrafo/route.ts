import { askStructured, errorResponse } from "@/lib/claude";
import { PARRAFO_SYSTEM } from "@/lib/prompts";
import { BulletSchema } from "@/lib/schemas";

export const maxDuration = 60;

const INSTRUCCIONES = {
  mejorar: "Hacelo más claro, específico y convincente.",
  corto: "Hacelo más corto (aprox. la mitad), sin perder la idea principal.",
  concreto: "Hacelo más concreto: menos adjetivos, más hechos y evidencia del CV.",
  calido: "Hacelo más cálido y humano, sin perder profesionalismo.",
} as const;

type Body = {
  parrafo: string;
  otros: string[];
  instruccion: keyof typeof INSTRUCCIONES;
  idioma: string;
  puesto: string;
  empresa: string;
};

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (!b.parrafo?.trim()) return Response.json({ error: "El párrafo está vacío.", code: "EMPTY" }, { status: 400 });
    const { texto } = await askStructured({
      system: PARRAFO_SYSTEM,
      schema: BulletSchema,
      effort: "low",
      maxTokens: 4000,
      content: [
        {
          type: "text",
          text: [
            `Idioma: ${b.idioma}`,
            `Carta para: ${b.puesto} en ${b.empresa}`,
            `Instrucción: ${INSTRUCCIONES[b.instruccion] ?? INSTRUCCIONES.mejorar}`,
            `Resto de la carta (contexto, no lo repitas):\n${b.otros.map((o) => `- ${o}`).join("\n")}`,
            `Párrafo a reescribir:\n${b.parrafo}`,
          ].join("\n\n"),
        },
      ],
    });
    return Response.json({ texto });
  } catch (err) {
    return errorResponse(err);
  }
}
