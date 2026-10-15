import { fetchSingleJob, parseBoardUrl } from "@/lib/match/connectors";
import { postingKey } from "@/lib/match/inventory";
import { loadInventory } from "@/lib/match/load";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({ url: z.string().max(600).optional(), text: z.string().max(12000).optional() });

/**
 * Agregar una búsqueda externa. Sólo se importa automáticamente desde ATS admitidos
 * (Greenhouse, Lever, Ashby) usando sus APIs públicas, nunca pidiendo una URL arbitraria del usuario.
 * Para cualquier otro sitio pedimos pegar la descripción. Nada se guarda en el servidor.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pedido inválido.", code: "BAD_REQUEST" }, { status: 400 });
  const url = parsed.data.url?.trim() ?? "";
  if (url) {
    let u: URL | null = null;
    try {
      u = new URL(url);
    } catch {
      return Response.json({ error: "El link no es válido.", code: "BAD_URL" }, { status: 400 });
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return Response.json({ error: "El link no es válido.", code: "BAD_URL" }, { status: 400 });
    if (parseBoardUrl(url)?.jobId) {
      try {
        const job = await fetchSingleJob(url, { retries: 1, timeoutMs: 10_000 });
        if (job) {
          const { postings } = await loadInventory();
          const known = postings.get(postingKey(job));
          return Response.json({
            job: {
              title: job.title,
              company: job.company,
              url: job.sourceUrl,
              text: job.descriptionText,
              location: [...job.locations, job.workplace.value === "remoto" ? "Remoto" : ""].filter(Boolean).join(" · "),
            },
            inInventory: !!known,
          });
        }
      } catch {
        // sigue abajo: pedimos el texto
      }
    }
  }
  const text = parsed.data.text?.trim() ?? "";
  if (text.length >= 200) return Response.json({ job: null, acceptedText: true });
  return Response.json(
    {
      error: url
        ? "No podemos importar este link automáticamente (sólo Greenhouse, Lever y Ashby). Pegá la descripción de la búsqueda."
        : "Pegá la descripción de la búsqueda (al menos unas líneas).",
      code: "NEEDS_TEXT",
    },
    { status: 422 },
  );
}
