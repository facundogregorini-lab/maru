import { paidFeatures } from "@/lib/billing/http";
import { RankingRequestSchema, invalidFields, type ExternalJob } from "@/lib/match/api-schemas";
import { workplaceFromText } from "@/lib/match/connectors";
import { withHiddenSection } from "@/lib/match/hidden";
import { analyzeStandalone, buildOpportunities } from "@/lib/match/inventory";
import { loadInventory, resolveId } from "@/lib/match/load";
import { rankOpportunities, weightsFromEnv, type RankOutput } from "@/lib/match/ranking";
import { RERANK_ELIGIBLE, RERANK_PENDING, rerank, rerankEnabled } from "@/lib/match/rerank";
import type { NormalizedPosting, StoredPosting } from "@/lib/match/types";

export const runtime = "nodejs";

/**
 * Ranking personalizado. Es sin estado: el perfil, las preferencias y las búsquedas propias
 * llegan en el pedido, se usan para ordenar y no se guardan ni se registran en logs.
 * Las mejores de la etapa por reglas se re-evalúan con IA (rerank.ts); esa evaluación queda
 * en memoria del proceso hasta una hora para no repetir llamadas al recargar.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 200_000) return Response.json({ error: "El pedido es demasiado grande.", code: "TOO_LARGE" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Pedido inválido.", code: "BAD_REQUEST" }, { status: 400 });
  }
  const parsed = RankingRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = invalidFields(parsed.error);
    return Response.json({ error: `Revisá tus datos: hay campos inválidos (${fields.join(", ")}).`, code: "BAD_REQUEST", fields }, { status: 400 });
  }
  const { profile, prefs, interactions, filters, external = [], limit, ia } = parsed.data;

  try {
    const { inv, postings, alias } = await loadInventory();
    // Guardadas y descartadas con el id de una copia ya agrupada apuntan al representante.
    const ids = (xs: string[]) => xs.map((id) => resolveId(alias, id));
    const inter = { saved: ids(interactions.saved), discarded: interactions.discarded.map((d) => ({ ...d, id: resolveId(alias, d.id) })) };
    const now = new Date();
    const own = external.map((e) => analyzeStandalone(externalToPosting(e), e.addedAt || now.toISOString()));
    const ownOpps = buildOpportunities(own).map((o) => ({ ...o, id: own.find((p) => p.key === o.primaryKey)!.externalId }));
    const allPostings = new Map<string, StoredPosting>(postings);
    for (const p of own) allPostings.set(p.key, p);

    const opportunities = [...inv.opportunities, ...ownOpps];
    // La web pide primero sin IA (resultados en segundos) y después el afinado, que puede tardar más.
    const available = rerankEnabled();
    const ai = available && ia !== false;
    const ranked = rankOpportunities({
      opportunities,
      postings: allPostings,
      profile,
      prefs,
      interactions: inter,
      filters,
      weights: weightsFromEnv(),
      // Con IA, la primera etapa entrega las 200 mejores para re-evaluar; después se recorta a la página.
      limit: ai ? Math.max(limit ?? 40, RERANK_ELIGIBLE, RERANK_PENDING) : limit,
      now,
    });
    // Segunda etapa: la IA re-evalúa las mejores que pasaron los filtros. Sin clave o con error, quedan las reglas.
    const paged = ai
      ? pageOf(await rerank({ result: ranked, profile, prefs, opportunities: new Map(opportunities.map((o) => [o.id, o])), postings: allPostings }), limit ?? 40)
      : ranked;
    // Oportunidades ocultas: en el plan gratis, las difuminadas llegan sólo con el porcentaje.
    const result = withHiddenSection(paged, await paidFeatures(req));

    return Response.json(
      {
        ...result,
        ia: { disponible: available, aplicada: ai },
        inventory: {
          generatedAt: inv.generatedAt,
          open: inv.opportunities.filter((o) => o.status === "abierta").length,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Nunca registramos el cuerpo del pedido (tiene datos personales).
    console.error("[match/ranking]", err instanceof Error ? err.message : "error");
    return Response.json({ error: "No pudimos armar tu ranking. Probá de nuevo.", code: "UNKNOWN" }, { status: 500 });
  }
}

/** La página pedida ("Ver más" suma de a 40), después de re-evaluar. */
function pageOf<T extends RankOutput>(r: T, limit: number): T {
  const eligible = r.eligible.slice(0, limit);
  const pending = r.pending.slice(0, limit);
  return { ...r, eligible, pending, ...(r.hiddenPool ? { hiddenPool: r.hiddenPool.slice(0, limit) } : {}), counts: { ...r.counts, shown: eligible.length + pending.length } };
}

function externalToPosting(e: ExternalJob): NormalizedPosting {
  return {
    sourceId: "usuario",
    boardId: "usuario",
    externalId: e.id,
    title: e.title || "Búsqueda agregada por vos",
    company: e.company,
    sourceUrl: e.url || `maru:usuario:${e.id}`,
    applyUrl: e.url || "",
    linkRequired: false,
    descriptionText: e.text,
    descriptionComplete: e.text.length > 400,
    locations: e.location ? [e.location] : [],
    countries: [],
    regionText: [],
    workplace: { value: workplaceFromText(`${e.location}\n${e.text.slice(0, 800)}`), from: "descripcion" },
    remoteFlag: null,
    employmentType: null,
    salary: null,
    publishedAt: null,
    updatedAt: null,
    expiresAt: null,
  };
}
