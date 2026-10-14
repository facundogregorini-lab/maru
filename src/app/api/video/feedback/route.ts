import { UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { VIDEO_FEEDBACK_SYSTEM } from "@/lib/prompts";
import { VideoFeedbackSchema } from "@/lib/schemas";

export const maxDuration = 120;

type Body = {
  guion: string;
  transcripcion: string;
  segundos: number;
  wpm: number;
  muletillas: Record<string, number>;
  /** Hasta 3 fotogramas JPEG en base64 (sin el prefijo data:). */
  fotogramas: string[];
};

const MAX_FRAME_B64 = 400_000;

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (!b.guion?.trim()) throw new UserFacingError("Falta el guion del video.", "BAD_REQUEST");
    const frames = (b.fotogramas ?? []).filter((f) => typeof f === "string" && f.startsWith("/9j/") && f.length < MAX_FRAME_B64).slice(0, 3);
    const content = [
      ...frames.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
      {
        type: "text" as const,
        text: [
          `<guion>\n${b.guion.trim()}\n</guion>`,
          `<transcripcion_automatica>\n${b.transcripcion?.trim() || "(vacía: el navegador no transcribió)"}\n</transcripcion_automatica>`,
          `<metricas>\nDuración: ${Math.round(b.segundos)} s\nPalabras por minuto: ${b.wpm || "sin dato"}\nMuletillas: ${
            Object.entries(b.muletillas ?? {})
              .map(([k, v]) => `${k} ×${v}`)
              .join(", ") || "ninguna detectada"
          }\nFotogramas: ${frames.length}\n</metricas>`,
        ].join("\n\n"),
      },
    ];
    const feedback = await askStructured({ system: VIDEO_FEEDBACK_SYSTEM, content, schema: VideoFeedbackSchema, effort: "low" });
    return Response.json({ feedback });
  } catch (err) {
    return errorResponse(err);
  }
}
