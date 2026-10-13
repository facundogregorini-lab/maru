import { askStructured, errorResponse } from "@/lib/claude";
import { BULLET_SYSTEM } from "@/lib/prompts";
import { BulletSchema } from "@/lib/schemas";

export const maxDuration = 60;

type Body = {
  bullet: string;
  cargo: string;
  empresa: string;
  otros: string[];
  puesto: string;
  palabrasClave: string[];
  idioma: string;
};

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (!b.bullet?.trim()) return Response.json({ error: "El logro está vacío.", code: "EMPTY" }, { status: 400 });
    const { texto } = await askStructured({
      system: BULLET_SYSTEM,
      schema: BulletSchema,
      effort: "low",
      maxTokens: 4000,
      content: [
        {
          type: "text",
          text: [
            `Idioma: ${b.idioma}`,
            `Vacante: ${b.puesto}. Palabras clave: ${b.palabrasClave.join(", ")}`,
            `Experiencia: ${b.cargo} en ${b.empresa}`,
            `Otros logros de esa experiencia (contexto, no los repitas):\n${b.otros.map((o) => `- ${o}`).join("\n")}`,
            `Logro a reescribir:\n${b.bullet}`,
          ].join("\n\n"),
        },
      ],
    });
    return Response.json({ texto });
  } catch (err) {
    return errorResponse(err);
  }
}
