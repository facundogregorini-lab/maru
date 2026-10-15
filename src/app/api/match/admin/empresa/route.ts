import { z } from "zod";
import { adminDenied } from "@/lib/match/admin";
import { FETCHERS, parseBoardUrl } from "@/lib/match/connectors";
import { boardIdFor, type CompanyEntry } from "@/lib/match/directory";
import { classifyEligibility } from "@/lib/match/eligibility";
import { loadDirectory } from "@/lib/match/load";
import { sourceById } from "@/lib/match/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ url: z.string().min(8).max(600), name: z.string().max(120).optional(), sector: z.string().max(80).optional() });

/**
 * Valida una empresa nueva a partir de la URL de su bolsa (Greenhouse, Lever o Ashby):
 * detecta el conector, consulta la API pública y devuelve la entrada lista para el directorio.
 * No escribe en el servidor (Vercel es de sólo lectura): la entrada se agrega a data/match/companies.json
 * con `npm run match:add-company -- <url>` o pegándola en el archivo.
 */
export async function POST(req: Request) {
  const denied = adminDenied(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pasá la URL de la bolsa de empleo.", code: "BAD_REQUEST" }, { status: 400 });
  const ats = parseBoardUrl(parsed.data.url);
  if (!ats) {
    return Response.json(
      { error: "No reconocemos esa URL. Por ahora: job-boards.greenhouse.io/…, jobs.lever.co/… o jobs.ashbyhq.com/…", code: "UNSUPPORTED" },
      { status: 422 },
    );
  }
  const source = sourceById(ats.sourceId);
  if (!source?.enabled) return Response.json({ error: `La fuente ${ats.sourceId} no está habilitada.`, code: "DISABLED" }, { status: 422 });

  const dir = await loadDirectory();
  const boardId = boardIdFor(ats.sourceId, ats.slug);
  const existing = dir.companies.find((c) => c.sourceId && c.slug && boardIdFor(c.sourceId, c.slug) === boardId);
  try {
    const res = await FETCHERS[ats.sourceId]({ sourceId: ats.sourceId, boardId, slug: ats.slug, region: ats.region, company: parsed.data.name }, { retries: 1, timeoutMs: 15_000 });
    const counts = { elegible: 0, por_confirmar: 0, no_elegible: 0 };
    for (const p of res.postings) counts[classifyEligibility(p).status]++;
    const entry: CompanyEntry = {
      name: parsed.data.name?.trim() || res.postings[0]?.company || ats.slug,
      sourceId: ats.sourceId,
      slug: ats.slug,
      region: ats.region,
      sector: parsed.data.sector?.trim() || "",
      evidence: parsed.data.url,
      addedAt: new Date().toISOString().slice(0, 10),
      status: "candidata",
    };
    return Response.json({ ok: true, alreadyInDirectory: !!existing, received: res.received, counts, entry });
  } catch (err) {
    return Response.json({ ok: false, error: `La API de ${source.name} no respondió para "${ats.slug}": ${(err as Error).message}`, code: "FETCH_FAILED" }, { status: 502 });
  }
}
