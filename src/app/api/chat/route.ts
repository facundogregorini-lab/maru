import { searchJobs } from "@/lib/busquedas";
import { FAST_MODEL, UserFacingError, askStructured, errorResponse } from "@/lib/claude";
import { CHAT_SYSTEM } from "@/lib/prompts";
import { ChatSchema } from "@/lib/schemas";

export const maxDuration = 60;

type Msg = { role: "user" | "maru"; text: string };
type Body = { messages?: Msg[]; perfil?: string };

const TOOLS: Record<string, { href: string; label: string }> = {
  match: { href: "/match", label: "Ver mi match" },
  postulacion: { href: "/postulacion", label: "Adaptar mi CV a un aviso" },
  cv: { href: "/cv", label: "Mejorar mi CV" },
  carta: { href: "/carta", label: "Escribir mi carta" },
  entrevista: { href: "/entrevista", label: "Practicar la entrevista" },
  video: { href: "/video", label: "Grabar mi video" },
  seguimiento: { href: "/seguimiento", label: "Ver mi seguimiento" },
  extension: { href: "/extension", label: "Bajar la extensión" },
};

/**
 * Chat con Maru (el "Orion" de jobright). La IA responde y, si corresponde, dice qué buscar:
 * los avisos los trae el servidor del inventario real, así nunca hay búsquedas inventadas.
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as Body;
    const messages = (Array.isArray(b.messages) ? b.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "maru") && typeof m.text === "string")
      .slice(-10)
      .map((m) => ({ ...m, text: m.text.slice(0, 1500) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") throw new UserFacingError("Escribime qué necesitás.", "BAD_REQUEST");

    const perfil = typeof b.perfil === "string" && b.perfil.trim() ? `<perfil_de_la_persona>\n${b.perfil.slice(0, 2000)}\n</perfil_de_la_persona>\n\n` : "";
    const historial = messages.map((m) => `${m.role === "user" ? "Persona" : "Maru"}: ${m.text}`).join("\n");
    const turn = await askStructured({
      system: CHAT_SYSTEM,
      schema: ChatSchema,
      effort: "low",
      maxTokens: 1500,
      model: FAST_MODEL,
      content: [{ type: "text", text: `${perfil}<conversacion>\n${historial}\n</conversacion>` }],
    });

    const q = turn.buscar.trim().slice(0, 60);
    const jobs = q ? (await searchJobs({ q, area: "", nivel: "", modalidad: "", donde: "ar", pagina: 1 })).results.slice(0, 4) : [];
    return Response.json({
      respuesta: turn.respuesta,
      jobs: jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, where: j.where, logo: j.logo })),
      verMas: q ? `/busquedas?q=${encodeURIComponent(q)}` : null,
      herramienta: turn.herramienta ? TOOLS[turn.herramienta] : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
